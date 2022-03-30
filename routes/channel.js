let express = require("express");
const Discord = require("discord.js");
let router = express.Router();
const { Client, Intents } = require("discord.js");
const config = require("../config.json");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_PRESENCES,
  ],
});

const axios = require("axios").default;

client.on("ready", () => {
  console.log(client.user.username + " is ready!");
});

// client token, referenced using the process.env
client.login(process.env.TOKEN_BOT);

/* Post channel creation request Body*/
router.post("/", (req, res) => {
  let email = req.body.email;
  let discordUserName = req.body.userName;
  let walletAddress = req.body.walletAddress;
  let agentName = req.body.agentName;
  let caseNumber = req.body.caseNumber;
  let channelName = `${agentName}-${discordUserName}_${caseNumber}`;

  //gets the server from the client
  let server = client.guilds.cache.find(
    (guild) => guild.name === config.guildName 
  );

  // if server is not found ends the code
  if (server == null) {
    console.log(config.serverNotFound);
    return;
  }
  // find channel category ID
  let category = server.channels.cache.find(
    (c) =>
      c.name === config.guildCategoryName && c.type === config.guildCategory
  );

  // if category is not found ends the code
  if (category == null) {
    console.log(config.channelNotFound);
    return;
  }

  //creates the channel
  server.channels
    .create(channelName, {
      type: "GUILD_TEXT",
    })
    .then((channel) => {
      // parent category of newly created text channel
      channel.setParent(category.id);
      // role of everyone, this is needed to hide chat
      let role = server.roles.cache.find((r) => r.name === config.everyone);

      // remove view access from all other users except bot
      channel.permissionOverwrites.edit(role, { VIEW_CHANNEL: false });
      //   VIEW_CHANNEL: true,
      // });

      // get all members in channel
      server.members.fetch().then((fetchedMembers) => {
        let member = fetchedMembers.find(
          // finds emember where username == username
          (member) => member.user.username === discordUserName
        );

        //add access to the user
        if (member != null) {
          channel.overwritePermissions.edit(member, {
            VIEW_CHANNEL: true,
          });
        }
        
      });
      res.json({ channelId: channel.id });
    });
});

module.exports = router;
