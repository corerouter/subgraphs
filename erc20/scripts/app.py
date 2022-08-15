from requests_html import HTMLSession
from web3 import Web3
from datetime import datetime
import time
import random


totalTokens = 400
tokenInOnePage = 100
RPC_URL = "https://mainnet.infura.io/v3/********************************"

tokenName = []
tokenAddress = []
tokenCreatorTransaction = []
createdTimestamp = []
createdMonth = []

session = HTMLSession()

i = 0
pageNum = 1
while (i < totalTokens) :
    response = session.get(f'https://etherscan.io/tokens?ps={tokenInOnePage}&p={pageNum}')
    j = 1
    while (j <= tokenInOnePage) :
        results = response.html.find(f'#tblResult > tbody > tr:nth-child({j}) > td:nth-child(2) > div > div > h3 > a')
        tokenName.append(results[0].text)
        links = results[0].links
        link = list(links)[0]
        tokenAddress.append(link[len('/token/'):])
        
        i += 1
        j += 1
        if (i >= totalTokens):
            break
    pageNum += 1

i = 0
while (i < totalTokens) :
    response = session.get(f'https://etherscan.io/address/{tokenAddress[i]}')
    results = response.html.find('#ContentPlaceHolder1_trContract > div > div.col-md-8 > span > a')
    
    tokenCreatorTransaction.append(results[0].text)
    i += 1
    time.sleep(random.randint(1, 10))

web3 = Web3(Web3.HTTPProvider(RPC_URL))
i = 0
while (i < totalTokens):
    blockNumber = web3.eth.getTransaction(tokenCreatorTransaction[i]).blockNumber
    timestamp = web3.eth.getBlock(blockNumber).timestamp
    createdTimestamp.append(timestamp)
    createdMonth.append(datetime.utcfromtimestamp(int(timestamp)).strftime('%Y-%m'))
    i += 1

output = open('tokens.json','w')
i = 0
while (i < totalTokens):
    output.writelines(f'[{tokenName[i]},{tokenAddress[i]},{tokenCreatorTransaction[i]},{createdTimestamp[i]},{createdMonth[i]}]\n')
    i += 1

output.close()
session.close()
