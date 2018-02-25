# Four Oh Two

This repository implements an experimental micro-transaction layer on top of HTTP using the Nano currency.

## Why Nano?

Nano is unique because the nodes are designed to run on commodity hardware and offers zero transaction fees. Zero transaction fees unlock a number of useful applications that are not previous where transaction fees are non-zero.

Potentially the Lightning Network could facilitate this functionality as well, we will attempt to make the implementation currency-agnostic.

## Jobs to be Done

1. Pay for services where the data flow is 1 request for 1 response with an advertised price
2. Pay for services where data is streamed over a single connection with an advertised price
3. Donate a user defined amount for access to a specific piece of content (URI)  


## Client

### Goals

The client should facilitate a use case where someone can load up NANO into their wallet, send it to the service and it is "used" as they make requests with a Service Voucher Payment (SVP) that they can generate without needing to interact with the server, from their own private key and the server wallet's public key.

The client should also facilitate a use case where the payments are more realtime. This use-case requires a functioning NANO node on the client's end.

### Implementation

A voucher is a off-chain claim to a pre-payment made on-chain.

After you have paid the service, the service will start decrementing your voucher as you use the service. You can also ask the service to "cash out" your voucher.

The Service Voucher Payment (SVP) is implemented as a JWT signed with the private key. This way the server can verify the request is from a client who has perviously paid them. We then encrypt this with the server's public key so that the server is the only one that can decode it with their private key. The client controls the expiration of their token, while the server implements some sanity limits.

Implemented in a similar fashion, but used for a specific purpose of requesting a refund for a service, there is also a Service Voucher Refund (SVR). Generating and sending this SVR proves you have control of the private key for the request. A SVR cannot be used for more than one refund request.

## Server - Payment Manager

The server will keep track of transactions on each address/wallet that it controls. It will interface with a NANO client to be notified in real time of new transactions. It will keep track of both deposits via NANO and usage of that deposited NANO against services on an application server.

The server will also facilitate refunds. The server will advertise a request refund endpoint. In order to support anonymity, the client will be able to specify a different NANO wallet to send the refund to than the wallet that did the deposit. The request to do this requires the user to prove they are in control of the private key.

Because the server keeps track of usage, we can return usage information with each request, calculated in real time.

### Implementation

The server implementation should allow for:

  * Specifying a base price on a number of routes
  * Specifying a base NANO address for multiple routes
  * Specifying different prices per route
  * Specifying different NANO addresses per route
  * Specifying a refund endpoint for the entire app
  * Defining different currencies and nodes for interaction


## HTTP Methods

| Method  | Existing | Cost Applies |
|---------|----------|--------------|
| HEAD    | Yes      | No           |
| OPTIONS | Yes      | No           |
| GET     | Yes      | Yes          |
| POST    | Yes      | Yes          |
| PUT     | Yes      | Yes          |
| DELETE  | Yes      | Yes          |
| REFUND  | No       | No           |


## Headers

| Header                   | Example Value   | Request  | Response |
|:------------------------ |:--------------- |:--------:|:--------:|
| Payment-Account-Currency | NANO            | &#10004; |          |
| Payment-Account-Address  | xrb_1mwnaed5... | &#10004; |          |
| Payment-Voucher          | ld23ke4IAes91.. | &#10004; |          |
| Content-Cost             | .0001           |          | &#10004; |
| Content-Account-Address  | xrb_eo3dke22... |          | &#10004; |
| Content-Cost-Per         | access/once/bit |          | &#10004; |
| Content-Cost-Currency    | NANO            |          | &#10004; |
| Payment-Refund-Endpoint  | /refund         |          | &#10004; |


## 402 Response Payload

| Key            | Value           | Description               |
|:-------------- |:--------------- |:------------------------- |
| serviceAccount | xrb_eo3dke22... | Service's payment account |
| hostname       | api.example.com | Server's hostname         |



## Service Voucher Payment (SVP) Encoding

1. Encode a JWT

  Header:
  ```
  {
    "alg": "RS256",
    "typ": "JWT"
  }
  ```

  Payload:

  ```
  {
    "host": "api.example.com",
    "exp": 1518557491
  }
  ```

  Secret: Payment-Account-Address Private Key

2. Encrypt JWT with server's public key

## Implementation details with NANO

| N  | Payment flow | Voucher flow |
|:--:|:------------ |:------------ |
| 1. | client sends a payment to the service's wallet | client creates and signs a voucher with their wallet's private key |
| 2. | service does not send a receive block immediately | client embeds the voucher in requests to the service |
| 3. | service keeps and internal record of requests against each pending send block | client uses up their voucher's value (which can be monitored via response headers) |
| 4. | the service adds a receive block for the associated still pending send block | client is notified 402 Payment required. |

* The client can pre-empt the 402 by sending another send block to the service account.
* If another send block is present for the client, we will automatically roll-over any leftover balance.
* If not, we will send a refund (depending on minimum transaction details)
