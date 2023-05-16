---
author: "Layle"
slug: "authenticating-via-sessiontickets-dbd"
title: "Authenticating to Dead by Daylight servers via Steam Session Tickets"
summary: "In this post we'll be looking into grabbing a valid bhvrSession cookie without SSL sniffing"
tags: ["game-hacking", "man-in-the-middle", "steam", "steam-session-tickets"]
date: 2023-05-08T17:00:00Z
draft: false
---


Dead by Daylight, like all other online games, needs an authentication mechanism to verify and differentiate its online users. This post aims to explain how you can obtain a legitimate authentication cookie for the game without having to sniff encrypted TLS traffic.

## Introduction to Steam Session Tickets
You may have already reversed or examined traffic related to an online game that's been released on Steam, and what I'm about to show you might seem familiar. The Steam server provides a function to grant you a signed session ticket that verifies a user's identity, enabling the game server to check whether the user actually owns the game or has a VAC ban record, among other parameters. Typically, access to these tickets is facilitated through the Steamworks SDK, and there's enough documentation on this subject available [here](https://partner.steamgames.com/doc/features/auth). A Steam session ticket is essentially a long hexadecimal string that begins with `14000000`.

Given this information, how can we obtain a valid authentication cookie (`bhvrSession`)? It's actually quite simple, since anyone who owns the game can invoke the session ticket API!

## Requesting a signed session ticket
The NodeJS package [`steam-user`](https://github.com/DoctorMcKay/node-steam-user) has functionality to log into a Steam account and then generating a valid session ticket. The following code can be used:

```js
const SteamUser = require('steam-user');

const steamUser = new SteamUser();
steamUser.logOn({ accountName: 'xxx', password: 'xxx' });
// If 2FA is enabled, it will interactively ask for the token 

steamUser.on('loggedOn', function() {
    console.log(`Logged into Steam as ${steamUser.steamID.getSteam3RenderedID()}`);

    // Sets your profile to online and then "fake launches" Dead by Daylight (App ID 381210)
    // This is actually not needed, but I decided to add it anyways while toying around with the library
    steamUser.setPersona(SteamUser.EPersonaState.Online);
    steamUser.gamesPlayed(381210, true);

    // Requests a signed session ticket
    steamUser.createAuthSessionTicket(381210, (err, ticket) => {
        console.log(err); // Should be null
        console.log(ticket.toString('hex')); // Print it as hex string
    });
});
```

After running this code you should see something along the lines of:

```
C:\Users\Layle\Documents\Projects\lol>node index.js
Steam Guard App Code: ABCDEF
Logged into Steam as [U:1:PROFILEID]
null
1400000071b7a40c57c4702095be0715010010019e0d59641800000001000000020000001c3c4a54000000003d00000001000000c4000000440000000400000095be0715011110011af105001c3c4a540df0adba0000000064775764e42673640100ce1601000300171908000000c8e308000000084f1200000000000df2596391e4c39693fd88a4e99e022a29a08708010b35f0fa3abcb396d6e173ea8c37ae21a5b0fb79d46d297f13bc6f369de19a762269a2f8b0791ce384c2612358b9937eca0942e147859c645b48010ff5822fe532b0afbd9a68fee9ccbe32cb2f47d02518d65b3d4d42b4053b8a27469ddd584c98923bd835d5844e190977
```

This hex string is our signed session ticket! Make sure to copy it as we will be referencing it in the next chapter. Please note that if you reauthenticate (e.g. launch the game) the token will invalidate and cannot be used.

## Grabbing a valid bhvrSession cookie
Actually grabbing a valid cookie will involve two things:
1. Requesting a signed session ticket (done)
2. Knowing the Kraken Secret Key (or not, actually; you'll see)

To this day I actually don't know what Kraken is, I just always found a way around it and in most cases it's not needed anyways. I have multiple SSL pinning bypasses to burn, so here is the secret: `X-Kraken-Content-Secret-Key: c6KYurOiikoX5kir08IRt1Rpuz5IIey7VAmTlTsG6hY=`. I don't think it's actually of any value as it sounded like some logging thing from my 1min research based on the game's strings. Anyways, shoot me a DM if it ever changes and you need it for whatever reason! Likewise, if you know what Kraken actually is, please do let me know on Discord (`Layle#6969`) or via [Twitter](https://twitter.com/layle_ctf).

That being said, you don't actually need it to grab a valid `bhvrSession`. You'll usually see the following set of headers:

```http
X-Kraken-Client-Platform: steam
X-Kraken-Client-Provider: steam
X-Kraken-Client-Resolution: 3440x1440
X-Kraken-Client-Timezone-Offset: -120
X-Kraken-Client-Os: 10.0.22621.1.256.64bit
X-Kraken-Client-Version: 3.6.1
X-Kraken-Content-Version: {"contentVersionId":"6.6.0_1091993live"}
X-Kraken-Content-Secret-Key: c6KYurOiikoX5kir08IRt1Rpuz5IIey7VAmTlTsG6hY=
```

If we simply remove `X-Kraken-Content-Version` **and** `X-Kraken-Content-Secret-Key` it will ignore the validation altogether so I decided to stick with that.

Now let's get back to grabbing the cookie. It is simply a matter of creating 1 HTTP request to `https://steam.live.bhvrdbd.com/api/v1/auth/provider/steam/login?token={STEAM_SESSION_TICKET}` where `STEAM_SESSION_TICKET` is the session ticket we requested earlier. The request and response look like the following:

![](/images/dbd/steam-auth.png)

Congrats! You're now a proud owner of a `bhvrSession` and can do whatever you want again (data mining, [grabbing your inventory and decrypting it](https://layle.me/posts/breaking-dead-by-daylight/), pushing inventories, you name it...). Here's an example of me grabbing my profile data (`FullProfile` via `/api/v1/players/me/states/FullProfile/binary`):

![](/images/dbd/fullprofile.png)