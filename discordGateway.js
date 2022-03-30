/**
  Simple(ish) example of discord gateway
  This code will get to ready, and then remain connected with heartbeats
  see https://discordapi.com/topics/gateway for more info
  zlib compression is implemented as it will be required in gateway v7 (so get used to it now)
*/
const config = require("./config.json");
const WebSocket = require("ws"); // npmjs.org/ws
const zlib = require("zlib-sync"); // npmjs.org/zlib-sync
const erlpack = require("erlpack"); // github.com/discordapp/erlpack
const os = require("os"); // from node "standard library"
const axios = require("axios").default;
const { Client, Intents } = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_PRESENCES,
  ],
});

client.on("ready", () => {
  console.log(client.user.username + " is Listening for messages!");
});
// client token, needs to be process.env.BOT_TOKEN
// if pushed to git, might need a new
//
client.login(process.env.TOKEN_BOT);

const OPCodes = {
  HEARTBEAT: 1,
  IDENTIFY: 2,
  HELLO: 10,
  HEARTBEAT_ACK: 11,
};

// zlib inflate context for zlib-stream
const inflate = new zlib.Inflate({
  chunkSize: 65535,
  flush: zlib.Z_SYNC_FLUSH,
});

// create websocket (technically you should perform a GET to /api/gateway and use the response)
const ws = new WebSocket(config.gateway);

// sequence used for sessions and heartbeats
let sequence = 0;

function send(op, d) {
  ws.send(erlpack.pack({ op, d }));
}

ws.onmessage = ({ data }) => {
  const l = data.length;
  // if data.length >= 4 and data ends with Z_SYNC_FLUSH constant
  const flush =
    l >= 4 &&
    data[l - 4] === 0x00 &&
    data[l - 3] === 0x00 &&
    data[l - 2] === 0xff &&
    data[l - 1] === 0xff;

  inflate.push(data, flush && zlib.Z_SYNC_FLUSH);

  if (!flush) return;

  // parse packet with erlpack after its inflated
  const packet = erlpack.unpack(inflate.result);

  // keep track of sequence for heartbeats
  if (packet.s) sequence = packet.s;

  // handle gateway ops
  switch (packet.op) {
    case OPCodes.HELLO:
      console.log("Got op 10 HELLO");
      // set heartbeat interval
      setInterval(
        () => send(OPCodes.HEARTBEAT, sequence),
        packet.d.heartbeat_interval
      );
      // https://discordapi.com/topics/gateway#gateway-identify
      send(OPCodes.IDENTIFY, {
        // you should put your token here _without_ the "Bot" prefix
        token: "Bot " + process.env.TOKEN_BOT,
        properties: {
          $os: process.platform,
          $browser: "node.js",
          $device: os.type(),
        },
        compress: false,
      });
  }

  console.log(JSON.parse(JSON.stringify(packet.d)));
  // handle gateway packet types
  if (!packet.t) return;
  switch (packet.t) {
    // we should get this after we send identify
    case config.ready:
      console.log("ready as", packet.d.user);
      break;

    // on create message, gets the content information and post it to salesforce
    case config.messageCreate:
      if (packet.d.author.username == client.user.username) {
        return;
      }
      // stores the username, message and file attchment in Variables
      let author = packet.d.author.username;
      let content = packet.d.content;  
      let channel_Id = packet.d.channel_id;
      let attachment = packet.d.attachments;
      let messageArray = (typeof attachment[0] !== 'undefined') ? attachment[0] : "";
      console.log(
        `${author}: ${content} in ${channel_Id} with attchment: ${messageArray?.proxy_url}`
      );
      // post the message to salesforce
      const data = {
        author,
        content,
        channel_Id,
        imageUrl: messageArray?.proxy_url,
        imageType: messageArray?.content_type,
        filename: messageArray?.filename,
      };
      console.log('Discord Data',data);

      axios({
        method: "post",
        url: config.salesforceWebHook, 
        data,  
      }).then( 
        (response) => { 
          console.log(
            "this means that is is working with attachment: " + response
          );
        },
        (error) => {
          console.log(
            "This means that is is not working with attachment: " + error
          );
        }
      );
  }
};

ws.onopen = () => console.log("websocket opened!");
ws.onclose = ws.onerror = (e) => {
  console.log(e);
};
