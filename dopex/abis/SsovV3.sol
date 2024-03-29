//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

// Libraries
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {SafeERC20} from "../external/libraries/SafeERC20.sol";

// Contracts
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {SsovV3State} from "./SsovV3State.sol";
import {SsovV3OptionsToken} from "../options-token/SsovV3OptionsToken.sol";
import {ContractWhitelist} from "../helpers/ContractWhitelist.sol";
import {Pausable} from "../helpers/Pausable.sol";

// Interfaces
import {IERC20} from "../external/interfaces/IERC20.sol";
import {IOptionPricing} from "../interfaces/IOptionPricing.sol";
import {IFeeStrategy} from "../interfaces/IFeeStrategy.sol";
import {IStakingStrategy} from "../staking-strategies/IStakingStrategy.sol";
import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {IVolatilityOracle} from "../interfaces/IVolatilityOracle.sol";

// Structs
import {VaultCheckpoint, WritePosition, EpochStrikeData, Addresses, EpochData} from "./SsovV3Structs.sol";

function getUintArray(uint256 _arrayLength)
    pure
    returns (uint256[] memory result)
{
    result = new uint256[](_arrayLength);
}

function valueGreaterThanZero(uint256 _value) pure returns (bool result) {
    assembly {
        result := iszero(_value)
    }
}

/// @title SSOV V3 contract
/// @dev A serious assumption made is that all reward tokens are in 1e18 precision. This contract will break if any other precision reward token is added.
contract SsovV3 is
    ReentrancyGuard,
    Pausable,
    ERC721,
    ERC721Enumerable,
    ERC721Burnable,
    AccessControl,
    ContractWhitelist,
    SsovV3State
{
    using SafeERC20 for IERC20;
    using Counters for Counters.Counter;

    /// @dev Token ID counter for write positions
    Counters.Counter private _tokenIdCounter;

    /*==== CONSTRUCTOR ====*/

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _underlyingSymbol,
        address _collateralToken,
        bool _isPut
    ) ERC721(_name, _symbol) {
        underlyingSymbol = _underlyingSymbol;
        collateralToken = IERC20(_collateralToken);
        collateralPrecision = 10**collateralToken.decimals();
        isPut = _isPut;

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MANAGER_ROLE, msg.sender);
    }

    /*==== METHODS ====*/

    /// @notice Pauses the vault for emergency cases
    /// @dev Can only be called by the owner
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Unpauses the vault
    /// @dev Can only be called by the owner
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Add a contract to the whitelist
    /// @dev Can only be called by the owner
    /// @param _contract Address of the contract that needs to be added to the whitelist
    function addToContractWhitelist(address _contract)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _addToContractWhitelist(_contract);
    }

    /// @notice Remove a contract to the whitelist
    /// @dev Can only be called by the owner
    /// @param _contract Address of the contract that needs to be removed from the whitelist
    function removeFromContractWhitelist(address _contract)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _removeFromContractWhitelist(_contract);
    }

    /// @notice Updates the delay tolerance for the expiry epoch function
    /// @dev Can only be called by the owner
    function updateExpireDelayTolerance(uint256 _expireDelayTolerance)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        expireDelayTolerance = _expireDelayTolerance;
        emit ExpireDelayToleranceUpdate(_expireDelayTolerance);
    }

    /// @notice Sets (adds) a list of addresses to the address list
    /// @dev Can only be called by the owner
    /// @param _addresses addresses of contracts in the Addresses struct
    function setAddresses(Addresses calldata _addresses)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        addresses = _addresses;
        emit AddressesSet(_addresses);
    }

    /// @notice Change the collateral token allowance to the StakingStrategy contract
    /// @dev Can only be called by the owner
    /// @param _increase bool
    /// @param _allowance uint256
    function changeAllowanceForStakingStrategy(
        bool _increase,
        uint256 _allowance
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_increase) {
            collateralToken.safeIncreaseAllowance(
                addresses.stakingStrategy,
                _allowance
            );
        } else {
            collateralToken.safeDecreaseAllowance(
                addresses.stakingStrategy,
                _allowance
            );
        }
    }

    /// @notice Transfers all funds to msg.sender
    /// @dev Can only be called by the owner
    /// @param tokens The list of erc20 tokens to withdraw
    /// @param transferNative Whether should transfer the native currency
    function emergencyWithdraw(address[] calldata tokens, bool transferNative)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _whenPaused();
        if (transferNative) payable(msg.sender).transfer(address(this).balance);

        IERC20 token;

        for (uint256 i; i < tokens.length; ) {
            token = IERC20(tokens[i]);
            token.safeTransfer(msg.sender, token.balanceOf(address(this)));

            unchecked {
                ++i;
            }
        }

        emit EmergencyWithdraw(msg.sender);
    }

    /// @dev Internal function to expire an epoch
    /// @param _settlementPrice the settlement price
    /// @param _settlementCollateralExchangeRate the settlement collateral exchange rate
    function _expire(
        uint256 _settlementPrice,
        uint256 _settlementCollateralExchangeRate
    ) private nonReentrant {
        _whenNotPaused();
        _epochNotExpired(currentEpoch);
        epochData[currentEpoch].settlementPrice = _settlementPrice;
        epochData[currentEpoch]
            .settlementCollateralExchangeRate = _settlementCollateralExchangeRate;

        _updateFinalEpochBalances();

        epochData[currentEpoch].expired = true;

        emit EpochExpired(msg.sender, _settlementPrice);
    }

    /// @notice Sets the current epoch as expired
    function expire() external {
        _isEligibleSender();
        (, uint256 epochExpiry) = getEpochTimes(currentEpoch);
        _validate(block.timestamp > epochExpiry, 1);
        _validate(block.timestamp < epochExpiry + expireDelayTolerance, 2);
        _expire(
            getUnderlyingPrice(),
            isPut
                ? (DEFAULT_PRECISION * DEFAULT_PRECISION) / getCollateralPrice()
                : (getUnderlyingPrice() * DEFAULT_PRECISION) /
                    getCollateralPrice()
        );
    }

    /// @notice Sets the current epoch as expired
    /// @dev Can only be called by the owner
    /// @param _settlementPrice The settlement price
    /// @param _settlementCollateralExchangeRate the settlement collateral exchange rate
    function expire(
        uint256 _settlementPrice,
        uint256 _settlementCollateralExchangeRate
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _epochNotExpired(currentEpoch);
        _expire(_settlementPrice, _settlementCollateralExchangeRate);
    }

    /// @dev Internal function to unstake collateral, gather yield and checkpoint each strike
    function _updateFinalEpochBalances() private {
        uint256[] memory strikes = epochData[currentEpoch].strikes;

        uint256[] memory rewardTokenAmounts = IStakingStrategy(
            addresses.stakingStrategy
        ).unstake();

        for (uint256 i; i < strikes.length; ) {
            _updateRewards(strikes[i], rewardTokenAmounts, true);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Bootstraps a new epoch with new strikes
    /// @dev Can only be called by the owner
    /// @param strikes the strikes for the epoch
    /// @param expiry the expiry for the epoch
    /// @param expirySymbol the expiry symbol for the epoch
    function bootstrap(
        uint256[] memory strikes,
        uint256 expiry,
        string memory expirySymbol
    ) external nonReentrant onlyRole(MANAGER_ROLE) {
        _whenNotPaused();

        uint256 nextEpoch = currentEpoch + 1;

        _validate(block.timestamp < expiry, 3);
        if (currentEpoch > 0) _validate(epochData[currentEpoch].expired, 4);

        // Set the next epoch strikes
        epochData[nextEpoch].strikes = strikes;

        // Set the next epoch start time
        epochData[nextEpoch].startTime = block.timestamp;

        // Set the next epochs expiry
        epochData[nextEpoch].expiry = expiry;

        // Increase the current epoch
        currentEpoch = nextEpoch;

        uint256 rewardTokensLength = IStakingStrategy(addresses.stakingStrategy)
            .getRewardTokens()
            .length;

        uint256 strike;

        SsovV3OptionsToken _optionsToken;

        for (uint256 i; i < strikes.length; ) {
            strike = strikes[i];
            // Create options tokens representing the option for selected strike in epoch
            _optionsToken = SsovV3OptionsToken(
                Clones.clone(addresses.optionsTokenImplementation)
            );
            _optionsToken.initialize(
                address(this),
                isPut,
                strike,
                expiry,
                underlyingSymbol,
                collateralToken.symbol(),
                expirySymbol
            );
            epochStrikeData[nextEpoch][strike].strikeToken = address(
                _optionsToken
            );

            epochStrikeData[nextEpoch][strike]
                .rewardStoredForPremiums = getUintArray(rewardTokensLength);
            epochStrikeData[nextEpoch][strike]
                .rewardDistributionRatiosForPremiums = getUintArray(
                rewardTokensLength
            );
            unchecked {
                ++i;
            }
        }
        epochData[nextEpoch].totalRewardsCollected = getUintArray(
            rewardTokensLength
        );
        epochData[nextEpoch].rewardDistributionRatios = getUintArray(
            rewardTokensLength
        );
        epochData[nextEpoch].rewardTokensToDistribute = IStakingStrategy(
            addresses.stakingStrategy
        ).getRewardTokens();

        if (isPut) {
            // For puts collateral is always considered against 1 USD
            epochData[nextEpoch].collateralExchangeRate =
                (DEFAULT_PRECISION * DEFAULT_PRECISION) /
                getCollateralPrice();
        } else {
            epochData[nextEpoch].collateralExchangeRate =
                (getUnderlyingPrice() * DEFAULT_PRECISION) /
                getCollateralPrice();
        }

        emit Bootstrap(nextEpoch, strikes);
    }

    /// @dev Internal function to checkpoint the vault for an epoch and strike
    /// @param strike strike
    /// @param collateralAdded collateral added
    function _vaultCheckpoint(uint256 strike, uint256 collateralAdded)
        private
        returns (uint256)
    {
        uint256 _epoch = currentEpoch;

        uint256 checkpointsLength = checkpoints[_epoch][strike].length;

        if (checkpointsLength == 0) {
            checkpoints[_epoch][strike].push(
                VaultCheckpoint({
                    accruedPremium: 0,
                    activeCollateral: 0,
                    totalCollateral: collateralAdded
                })
            );
            return checkpointsLength;
        }

        VaultCheckpoint memory _checkpoint = checkpoints[_epoch][strike][
            checkpointsLength - 1
        ];

        if (_checkpoint.activeCollateral > 0) {
            checkpoints[_epoch][strike].push(
                VaultCheckpoint({
                    accruedPremium: 0,
                    activeCollateral: 0,
                    totalCollateral: collateralAdded
                })
            );
            return checkpointsLength;
        } else {
            checkpoints[_epoch][strike][
                checkpointsLength - 1
            ] = VaultCheckpoint({
                accruedPremium: _checkpoint.accruedPremium,
                activeCollateral: _checkpoint.activeCollateral,
                totalCollateral: _checkpoint.totalCollateral + collateralAdded
            });
            return checkpointsLength - 1;
        }
    }

    /// @dev Internal function to squeeze collateral from n checkpoints to fullfil a purchase
    /// @param _strike strike
    /// @param _requiredCollateral required collateral to fullfil purchase
    /// @param _premium premium awarded
    function _squeeze(
        uint256 _strike,
        uint256 _requiredCollateral,
        uint256 _premium
    ) private {
        VaultCheckpoint memory _checkpoint;

        uint256 _epoch = currentEpoch;
        uint256 _acquiredCollateral;
        uint256 _availableCollateral;
        uint256 _remainingRequiredCollateral;
        uint256 _premiumPerCollateral = (_premium * collateralPrecision) /
            _requiredCollateral;
        uint256 _checkpointPointer = epochStrikeData[_epoch][_strike]
            .checkpointPointer;

        while (_acquiredCollateral < _requiredCollateral) {
            _checkpoint = checkpoints[_epoch][_strike][_checkpointPointer];

            _remainingRequiredCollateral =
                _requiredCollateral -
                _acquiredCollateral;

            _availableCollateral =
                _checkpoint.totalCollateral -
                _checkpoint.activeCollateral;

            if (_availableCollateral >= _remainingRequiredCollateral) {
                _acquiredCollateral += _remainingRequiredCollateral;
                checkpoints[_epoch][_strike][_checkpointPointer]
                    .activeCollateral += _remainingRequiredCollateral;
                checkpoints[_epoch][_strike][_checkpointPointer]
                    .accruedPremium +=
                    (_remainingRequiredCollateral * _premiumPerCollateral) /
                    collateralPrecision;
            } else {
                _acquiredCollateral += _availableCollateral;
                checkpoints[_epoch][_strike][_checkpointPointer]
                    .activeCollateral += _availableCollateral;
                checkpoints[_epoch][_strike][_checkpointPointer]
                    .accruedPremium +=
                    (_availableCollateral * _premiumPerCollateral) /
                    collateralPrecision;
                _checkpointPointer += 1;
            }

            epochStrikeData[_epoch][_strike]
                .checkpointPointer = _checkpointPointer;
        }
    }

    /// @dev Internal function to mint a write position token
    /// @param to the address to mint the position to
    function _mintPositionToken(address to) private returns (uint256 tokenId) {
        tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
    }

    /// @dev Calculates & updates the total rewards collected & the rewards distribution ratios
    /// @param strike the strike
    /// @param totalRewardsArray the totalRewardsArray
    /// @param isPurchase whether this was called on purchase
    function _updateRewards(
        uint256 strike,
        uint256[] memory totalRewardsArray,
        bool isPurchase
    ) private returns (uint256[] memory rewardsDistributionRatios) {
        rewardsDistributionRatios = getUintArray(totalRewardsArray.length);
        uint256 newRewardsCollected;

        for (uint256 i; i < totalRewardsArray.length; ) {
            // Calculate the new rewards accrued
            newRewardsCollected =
                totalRewardsArray[i] -
                epochData[currentEpoch].totalRewardsCollected[i];

            // Update the new total rewards accrued
            epochData[currentEpoch].totalRewardsCollected[
                i
            ] = totalRewardsArray[i];

            // Calculate the reward distribution ratios for the new rewards accrued
            if (epochData[currentEpoch].totalCollateralBalance == 0) {
                rewardsDistributionRatios[i] = 0;
            } else {
                rewardsDistributionRatios[i] =
                    (newRewardsCollected * collateralPrecision) /
                    epochData[currentEpoch].totalCollateralBalance;
            }

            // Add it to the current reward distribution ratios
            epochData[currentEpoch].rewardDistributionRatios[
                    i
                ] += rewardsDistributionRatios[i];

            if (isPurchase) {
                // Add the new rewards accrued for the premiums staked until now
                epochStrikeData[currentEpoch][strike].rewardStoredForPremiums[
                        i
                    ] +=
                    ((epochData[currentEpoch].rewardDistributionRatios[i] -
                        epochStrikeData[currentEpoch][strike]
                            .rewardDistributionRatiosForPremiums[i]) *
                        epochStrikeData[currentEpoch][strike].totalPremiums) /
                    collateralPrecision;
                // Update the reward distribution ratios for the strike
                epochStrikeData[currentEpoch][strike]
                    .rewardDistributionRatiosForPremiums[i] = epochData[
                    currentEpoch
                ].rewardDistributionRatios[i];
            }

            rewardsDistributionRatios[i] = epochData[currentEpoch]
                .rewardDistributionRatios[i];

            unchecked {
                ++i;
            }
        }
    }

    /// @notice Deposit into the ssov to mint options in the next epoch for selected strikes
    /// @param strikeIndex Index of strike
    /// @param amount Amout of collateralToken to deposit
    /// @param to Address of to send the write position to
    /// @return tokenId token id of the deposit token
    function deposit(
        uint256 strikeIndex,
        uint256 amount,
        address to
    ) public nonReentrant returns (uint256 tokenId) {
        uint256 epoch = currentEpoch;

        _whenNotPaused();
        _isEligibleSender();
        _epochNotExpired(epoch);
        _valueNotZero(amount);

        // Must be a valid strike
        uint256 strike = epochData[epoch].strikes[strikeIndex];
        _valueNotZero(strike);

        // Transfer collateralToken from msg.sender (maybe different from user param) to ssov
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);

        // Stake the collateral into the staking strategy and calculates rewards
        uint256[] memory rewardDistributionRatios = _updateRewards(
            strike,
            IStakingStrategy(addresses.stakingStrategy).stake(amount),
            false
        );

        // Checkpoint the vault
        uint256 checkpointIndex = _vaultCheckpoint(strike, amount);

        // Update the total collateral balance
        epochData[currentEpoch].totalCollateralBalance += amount;
        epochStrikeData[currentEpoch][strike].totalCollateral += amount;

        // Mint a write position token
        tokenId = _mintPositionToken(to);

        // Store the write position
        writePositions[tokenId] = WritePosition({
            epoch: epoch,
            strike: strike,
            collateralAmount: amount,
            checkpointIndex: checkpointIndex,
            rewardDistributionRatios: rewardDistributionRatios
        });

        emit Deposit(tokenId, to, msg.sender);
    }

    /// @notice Purchases options for the current epoch
    /// @param strikeIndex Strike index for current epoch
    /// @param amount Amount of options to purchase
    /// @param to address to send the purchased options to
    function purchase(
        uint256 strikeIndex,
        uint256 amount,
        address to
    ) external nonReentrant returns (uint256 premium, uint256 totalFee) {
        _whenNotPaused();
        _isEligibleSender();
        _valueNotZero(amount);

        uint256 epoch = currentEpoch;

        // Check if expiry time is beyond block.timestamp
        (, uint256 epochExpiry) = getEpochTimes(epoch);
        _validate(block.timestamp < epochExpiry, 5);

        uint256 strike = epochData[epoch].strikes[strikeIndex];
        _valueNotZero(strike);

        // Check if vault has enough collateral to write the options
        uint256 availableCollateral = epochStrikeData[epoch][strike]
            .totalCollateral - epochStrikeData[epoch][strike].activeCollateral;
        uint256 requiredCollateral = isPut
            ? (amount *
                strike *
                collateralPrecision *
                epochData[epoch].collateralExchangeRate) /
                (OPTIONS_PRECISION * DEFAULT_PRECISION * DEFAULT_PRECISION)
            : (amount *
                epochData[epoch].collateralExchangeRate *
                collateralPrecision) / (DEFAULT_PRECISION * OPTIONS_PRECISION); /* 1e8 is the precision for the collateralExchangeRate, 1e18 is the precision of the options token */

        _validate(requiredCollateral < availableCollateral, 6);

        // Get total premium for all options being purchased
        premium = calculatePremium(strike, amount, epochExpiry);

        // Total fee charged
        totalFee = calculatePurchaseFees(strike, amount);

        _squeeze(strike, requiredCollateral, premium);

        // Transfer premium from msg.sender (need not be same as user)
        collateralToken.safeTransferFrom(
            msg.sender,
            address(this),
            premium + totalFee
        );

        // Stake premium into the staking strategy and calculates rewards
        _updateRewards(
            strike,
            IStakingStrategy(addresses.stakingStrategy).stake(premium),
            true
        );

        // Update active collateral
        epochStrikeData[epoch][strike].activeCollateral += requiredCollateral;

        // Update total premiums
        epochStrikeData[epoch][strike].totalPremiums += premium;

        // Update the totalCollateralBalance
        epochData[epoch].totalCollateralBalance += premium;

        // Transfer fee to FeeDistributor
        collateralToken.safeTransfer(addresses.feeDistributor, totalFee);

        // Mint option tokens
        SsovV3OptionsToken(epochStrikeData[epoch][strike].strikeToken).mint(
            to,
            amount
        );

        emit Purchase(epoch, strike, amount, premium, totalFee, to, msg.sender);
    }

    /// @notice Settle calculates the PnL for the user and withdraws the PnL in the BaseToken to the user. Will also the burn the option tokens from the user.
    /// @param strikeIndex Strike index
    /// @param amount Amount of options
    /// @param to The address to transfer pnl too
    /// @return pnl
    function settle(
        uint256 strikeIndex,
        uint256 amount,
        uint256 epoch,
        address to
    ) external nonReentrant returns (uint256 pnl) {
        _whenNotPaused();
        _isEligibleSender();
        _valueNotZero(amount);
        _epochExpired(epoch);

        uint256 strike = epochData[epoch].strikes[strikeIndex];

        SsovV3OptionsToken strikeToken = SsovV3OptionsToken(
            epochStrikeData[epoch][strike].strikeToken
        );

        _validate(strikeToken.balanceOf(msg.sender) >= amount, 10);

        // Burn option tokens from user
        strikeToken.burnFrom(msg.sender, amount);

        // Get the settlement price for the epoch
        uint256 settlementPrice = epochData[epoch].settlementPrice;

        // Calculate pnl
        pnl = calculatePnl(
            settlementPrice,
            strike,
            amount,
            epochData[epoch].settlementCollateralExchangeRate
        );

        // Total fee charged
        uint256 totalFee = calculateSettlementFees(pnl);

        _valueNotZero(pnl);

        // Transfer fee to FeeDistributor
        collateralToken.safeTransfer(addresses.feeDistributor, totalFee);

        // Transfer PnL
        collateralToken.safeTransfer(to, pnl - totalFee);

        emit Settle(
            epoch,
            strike,
            amount,
            pnl - totalFee,
            totalFee,
            to,
            msg.sender
        );
    }

    /// @notice Withdraw from the ssov via burning a write position token
    /// @param tokenId token id of the write position
    /// @param to address to transfer collateral and rewards
    function withdraw(uint256 tokenId, address to)
        external
        nonReentrant
        returns (
            uint256 collateralTokenWithdrawAmount,
            uint256[] memory rewardTokenWithdrawAmounts
        )
    {
        _whenNotPaused();
        _isEligibleSender();

        (
            uint256 epoch,
            uint256 strike,
            uint256 collateralAmount,
            uint256 checkpointIndex,
            uint256[] memory rewardDistributionRatios
        ) = writePosition(tokenId);

        _valueNotZero(strike);
        _epochExpired(epoch);

        // Burn the write position token
        burn(tokenId);

        // Get the checkpoint
        VaultCheckpoint memory _checkpoint = checkpoints[epoch][strike][
            checkpointIndex
        ];

        // Rewards calculations
        rewardTokenWithdrawAmounts = getUintArray(
            epochData[epoch].rewardTokensToDistribute.length
        );

        uint256 accruedPremium = (_checkpoint.accruedPremium *
            collateralAmount) / _checkpoint.totalCollateral;

        uint256 optionsWritten = isPut
            ? (_checkpoint.activeCollateral *
                DEFAULT_PRECISION *
                DEFAULT_PRECISION *
                OPTIONS_PRECISION) /
                (strike *
                    collateralPrecision *
                    epochData[epoch].collateralExchangeRate)
            : (_checkpoint.activeCollateral *
                OPTIONS_PRECISION *
                DEFAULT_PRECISION) /
                (epochData[epoch].collateralExchangeRate * collateralPrecision);

        // Calculate the withdrawable collateral amount
        collateralTokenWithdrawAmount =
            ((_checkpoint.totalCollateral -
                calculatePnl(
                    epochData[epoch].settlementPrice,
                    strike,
                    optionsWritten,
                    epochData[epoch].settlementCollateralExchangeRate
                )) * collateralAmount) /
            _checkpoint.totalCollateral;

        // Add premiums
        collateralTokenWithdrawAmount += accruedPremium;

        // Calculate and transfer rewards
        for (uint256 i; i < rewardTokenWithdrawAmounts.length; ) {
            rewardTokenWithdrawAmounts[i] +=
                ((epochData[epoch].rewardDistributionRatios[i] -
                    rewardDistributionRatios[i]) * collateralAmount) /
                collateralPrecision;
            if (epochStrikeData[epoch][strike].totalPremiums > 0)
                rewardTokenWithdrawAmounts[i] +=
                    (accruedPremium *
                        epochStrikeData[epoch][strike].rewardStoredForPremiums[
                            i
                        ]) /
                    epochStrikeData[epoch][strike].totalPremiums;
            IERC20(epochData[epoch].rewardTokensToDistribute[i]).safeTransfer(
                to,
                rewardTokenWithdrawAmounts[i]
            );
            unchecked {
                ++i;
            }
        }

        // Transfer the collateralTokenWithdrawAmount
        collateralToken.safeTransfer(to, collateralTokenWithdrawAmount);

        emit Withdraw(
            tokenId,
            collateralTokenWithdrawAmount,
            rewardTokenWithdrawAmounts,
            to,
            msg.sender
        );
    }

    /*==== VIEWS ====*/

    /// @notice Returns the price of the underlying in USD in 1e8 precision
    function getUnderlyingPrice() public view returns (uint256) {
        return IPriceOracle(addresses.priceOracle).getUnderlyingPrice();
    }

    /// @notice Returns the price of the collateral token in 1e8 precision
    /// @dev This contract assumes that this price can never decrease in ratio of the underlying price
    function getCollateralPrice() public view returns (uint256) {
        return IPriceOracle(addresses.priceOracle).getCollateralPrice();
    }

    /// @notice Returns the volatility from the volatility oracle
    /// @param _strike Strike of the option
    function getVolatility(uint256 _strike) public view returns (uint256) {
        return
            IVolatilityOracle(addresses.volatilityOracle).getVolatility(
                _strike
            );
    }

    /// @notice Calculate premium for an option
    /// @param _strike Strike price of the option
    /// @param _amount Amount of options (1e18 precision)
    /// @param _expiry Expiry of the option
    /// @return premium in collateralToken in collateral precision
    function calculatePremium(
        uint256 _strike,
        uint256 _amount,
        uint256 _expiry
    ) public view returns (uint256 premium) {
        premium = (IOptionPricing(addresses.optionPricing).getOptionPrice(
            isPut,
            _expiry,
            _strike,
            getUnderlyingPrice(),
            getVolatility(_strike)
        ) * _amount);

        premium =
            (premium * collateralPrecision) /
            (getCollateralPrice() * OPTIONS_PRECISION);
    }

    /// @notice Calculate Pnl
    /// @param price price of the underlying asset
    /// @param strike strike price of the option
    /// @param amount amount of options
    /// @param collateralExchangeRate collateral exchange rate
    function calculatePnl(
        uint256 price,
        uint256 strike,
        uint256 amount,
        uint256 collateralExchangeRate
    ) public view returns (uint256) {
        if (isPut)
            return
                strike > price
                    ? ((strike - price) *
                        amount *
                        collateralPrecision *
                        collateralExchangeRate) /
                        (OPTIONS_PRECISION *
                            DEFAULT_PRECISION *
                            DEFAULT_PRECISION)
                    : 0;
        return
            price > strike
                ? (((price - strike) *
                    amount *
                    collateralPrecision *
                    collateralExchangeRate) / price) /
                    (OPTIONS_PRECISION * DEFAULT_PRECISION)
                : 0;
    }

    /// @notice Calculate fees for purchase
    /// @param strike strike price of the BaseToken option
    /// @param amount amount of options being bought
    function calculatePurchaseFees(uint256 strike, uint256 amount)
        public
        view
        returns (uint256)
    {
        return ((IFeeStrategy(addresses.feeStrategy).calculatePurchaseFees(
            getUnderlyingPrice(),
            strike,
            amount
        ) * collateralPrecision) / getCollateralPrice());
    }

    /// @notice Calculate fees for settlement of options
    /// @param pnl total pnl
    function calculateSettlementFees(uint256 pnl)
        public
        view
        returns (uint256)
    {
        return IFeeStrategy(addresses.feeStrategy).calculateSettlementFees(pnl);
    }

    /// @notice Returns start and end times for an epoch
    /// @param epoch Target epoch
    function getEpochTimes(uint256 epoch)
        public
        view
        returns (uint256 start, uint256 end)
    {
        return (epochData[epoch].startTime, epochData[epoch].expiry);
    }

    /// @notice View a write position
    /// @param tokenId tokenId a parameter just like in doxygen (must be followed by parameter name)
    function writePosition(uint256 tokenId)
        public
        view
        returns (
            uint256 epoch,
            uint256 strike,
            uint256 collateralAmount,
            uint256 checkpointIndex,
            uint256[] memory rewardDistributionRatios
        )
    {
        WritePosition memory _writePosition = writePositions[tokenId];

        return (
            _writePosition.epoch,
            _writePosition.strike,
            _writePosition.collateralAmount,
            _writePosition.checkpointIndex,
            _writePosition.rewardDistributionRatios
        );
    }

    /// @notice Returns the data for an epoch
    /// @param epoch the epoch
    function getEpochData(uint256 epoch)
        external
        view
        returns (EpochData memory)
    {
        return epochData[epoch];
    }

    /// @notice Returns the checkpoints for an epoch and strike
    /// @param epoch the epoch
    /// @param strike the strike
    function getEpochStrikeCheckpointsLength(uint256 epoch, uint256 strike)
        external
        view
        returns (uint256)
    {
        return checkpoints[epoch][strike].length;
    }

    /// @notice Returns the data for an epoch and strike
    /// @param epoch the epoch
    /// @param strike the strike
    function getEpochStrikeData(uint256 epoch, uint256 strike)
        external
        view
        returns (EpochStrikeData memory)
    {
        return epochStrikeData[epoch][strike];
    }

    /*==== PRIVATE FUCNTIONS FOR REVERTS ====*/

    /// @dev Internal function to check if the epoch passed is not expired. Revert if expired.
    /// @param _epoch the epoch
    function _epochNotExpired(uint256 _epoch) private view {
        _validate(!epochData[_epoch].expired, 7);
    }

    /// @dev Internal function to check if the value passed is not zero. Revert if 0.
    /// @param _value the value
    function _valueNotZero(uint256 _value) private pure {
        _validate(!valueGreaterThanZero(_value), 8);
    }

    /// @dev Internal function to check if the epoch passed is expired. Revert if not expired.
    /// @param _epoch the epoch
    function _epochExpired(uint256 _epoch) private view {
        _validate(epochData[_epoch].expired, 9);
    }

    /// @dev Internal function to validate a condition
    /// @param _condition boolean condition
    /// @param _errorCode error code to revert with
    function _validate(bool _condition, uint256 _errorCode) private pure {
        if (!_condition) revert SsovV3Error(_errorCode);
    }

    error SsovV3Error(uint256);

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721, ERC721Enumerable) {
        _whenNotPaused();
        super._beforeTokenTransfer(from, to, tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

/*==== ERROR CODE MAPPING ====*/
// 1 - block.timestamp must be greater than expiry timestamp
// 2 - block.timestamp must be lesser than expiry timestamp + delay tolerance
// 3 - block.timestamp must be lesser than the passed expiry timestamp
// 4 - If current epoch is greater than 0 then the current epoch must be expired to bootstrap
// 5 - block.timestamp must be lesser than the expiry timestamp
// 6 - required collateral must be lesser than the available collateral
// 7 - epoch must not be expired
// 8 - value must not be zero
// 9 - epoch must be expired
// 10 - option token balance of msg.sender should be greater than or equal to amount being settled