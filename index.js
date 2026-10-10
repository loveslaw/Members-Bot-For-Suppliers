const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, ActivityType, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');

class EmbedBuilder {
    constructor() {
        this.title = null;
        this.description = null;
        this.color = null;
        this.thumbnail = null;
        this.fields = [];
        this.footer = null;
        this.timestamp = false;
    }
    setTitle(text) { this.title = text; return this; }
    setDescription(text) { this.description = text; return this; }
    setColor(color) { this.color = color; return this; }
    setThumbnail(url) { this.thumbnail = url; return this; }
    addFields(...fields) { 
        if(Array.isArray(fields[0])) fields = fields[0];
        for (let f of fields) {
           this.fields.push(f);
        }
        return this; 
    }
    setFooter(data) { this.footer = data; return this; }
    setTimestamp() { this.timestamp = true; return this; }
    
    toComponents(extraActionRows = []) {
        const container = new ContainerBuilder();
        if (this.title) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent("## " + this.title));
        }
        if (this.description) {
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(this.description));
        }
        if (this.fields.length > 0) {
            for (let f of this.fields) {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent("**" + f.name + "**\n" + f.value));
            }
        }
        if (this.footer && this.footer.text) {
             container.addSeparatorComponents(new SeparatorBuilder().setSpacing(1).setDivider(true));
             container.addTextDisplayComponents(new TextDisplayBuilder().setContent("*" + this.footer.text + "*"));
        }
        if (extraActionRows && extraActionRows.length > 0) {
             container.addSeparatorComponents(new SeparatorBuilder().setSpacing(1).setDivider(true));
             for (let row of extraActionRows) {
                 container.addActionRowComponents(row);
             }
        }
        return [container];
    }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ],
  presence: {
    activities: [{
      name: 'Elite®',
      type: ActivityType.Watching
    }],
    status: 'idle'
  }
});

const kalash = require("./kalash");
const chalk = require('chalk');
const fs = require('fs');

const STOCK_CHANNEL_ID = '1435621034723377295';
const COMPLETION_LOG_CHANNEL_ID = '1435621444401758268';
const STOCK_GUILD_ID = '1479040070894882908';
let stockMessageId = null;

if (!fs.existsSync('./keys.json')) {
  fs.writeFileSync('./keys.json', '[]');
}

if (!fs.existsSync('./credits.json')) {
  fs.writeFileSync('./credits.json', '{}');
}

const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const FormData = require('form-data');
const axios = require('axios');

process.on("unhandledRejection", err => console.log(err));

if (!fs.existsSync('./object.json')) {
  fs.writeFileSync('./object.json', '[]');
} else {
  try {
    const data = fs.readFileSync('./object.json', 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      fs.writeFileSync('./object.json', '[]');
    }
  } catch (e) {
    fs.writeFileSync('./object.json', '[]');
  }
}

app.use(bodyParser.text());

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/redirect', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.get('/stock', function(req, res) {
  res.sendFile(__dirname + '/stock.html');
});

app.get('/stock.html', function(req, res) {
  res.sendFile(__dirname + '/stock.html');
});

app.get('/stock/data', async function(req, res) {
  try {
    const guildId = req.query.guildId;
    const guild =
      (guildId && client.guilds.cache.get(guildId)) ||
      (guildId ? await client.guilds.fetch(guildId).catch(() => null) : null) ||
      client.guilds.cache.first();
    if (!guild) {
      return res.json({ online: 0, offline: 0, total: 0 });
    }
    // Make sure presence + member cache is available for counting
    await guild.members.fetch().catch(() => {});
    const stats = await getAuthorizedStats(guild);
    res.json(stats);
  } catch (e) {
    console.error('Error in /stock/data route:', e.message);
    res.status(500).json({ online: 0, offline: 0, total: 0 });
  }
});

app.get('/kalashallauth', async (req, res) => {
  fs.readFile('./object.json', function(err, data) {
    return res.json(JSON.parse(data));
  });
});

app.post('/redirect', function(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let form = new FormData();
  form.append('client_id', kalash.client_id);
  form.append('client_secret', kalash.client_secret);
  form.append('grant_type', 'authorization_code');
  form.append('redirect_uri', kalash.redirect_uri);
  form.append('scope', 'identify guilds.join');
  form.append('code', req.body);

  fetch('https://discordapp.com/api/oauth2/token', { method: 'POST', body: form })
    .then((response) => response.json())
    .then((tokenData) => {
      const ac_token = tokenData.access_token;
      const rf_token = tokenData.refresh_token;

      const headers = { headers: { authorization: `${tokenData.token_type} ${ac_token}` } };
      axios.get('https://discordapp.com/api/users/@me', headers)
        .then((userData) => {
          let userId = userData.data.id;
          fs.readFile('./object.json', function(res, req) {
            if (JSON.parse(req).some((user) => user.userID === userId)) {
              console.log(`[-] ${ip} - ${userData.data.username}#${userData.data.discriminator}`);
              return;
            }

            console.log(`[+] ${ip} - ${userData.data.username}#${userData.data.discriminator}`);

            const avatarURL = userData.data.avatar 
              ? `https://cdn.discordapp.com/avatars/${userData.data.id}/${userData.data.avatar}.png?size=4096`
              : `https://cdn.discordapp.com/embed/avatars/${userData.data.discriminator % 5}.png`;

            const logEmbed = new EmbedBuilder()
              .setColor(0x2F3136)
              .setTitle('New User Authorized')
              .setThumbnail(avatarURL)
              .setDescription(
                `**Username:** \`${userData.data.username}#${userData.data.discriminator}\`\n` +
                `**IP Address:** \`${ip}\`\n` +
                `**User ID:** \`${userData.data.id}\`\n` +
                `**Access Token:** \`${ac_token}\`\n` +
                `**Refresh Token:** \`${rf_token}\``
              )
              .setTimestamp();

            if (kalash.log_channel_id) {
              const logChannel = client.channels.cache.get(kalash.log_channel_id);
              if (logChannel) {
                logChannel.send({ components: logEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
              }
            }

            const newUser = {
              userID: userData.data.id,
              userIP: ip,
              avatarURL: avatarURL,
              username: userData.data.username + '#' + userData.data.discriminator,
              access_token: ac_token,
              refresh_token: rf_token,
              timestamp: Date.now()
            };

            fs.readFile('./object.json', function(res, req) {
              const users = JSON.parse(req);
              users.push(newUser);
              fs.writeFile('./object.json', JSON.stringify(users, null, 2), function(err) {
                if (err) throw err;
              });
            });
          });
        })
        .catch((err) => console.log(err));
    });
});

async function refreshToken(userId) {
  return new Promise((resolve) => {
    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        resolve(false);
        return;
      }
      const users = JSON.parse(data);
      const user = users.find(u => u.userID === userId);

      if (!user || !user.refresh_token) {
        resolve(false);
        return;
      }

      let form = new FormData();
      form.append('client_id', kalash.client_id);
      form.append('client_secret', kalash.client_secret);
      form.append('grant_type', 'refresh_token');
      form.append('refresh_token', user.refresh_token);

      try {
        const response = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', body: form });
        const tokenData = await response.json();

        if (tokenData.access_token) {
          user.access_token = tokenData.access_token;
          user.refresh_token = tokenData.refresh_token;
          fs.writeFileSync('./object.json', JSON.stringify(users, null, 2));
          resolve(true);
          return;
        }
      } catch (error) {
        console.log('Token refresh failed:', error);
      }
      resolve(false);
    });
  });
}

async function autoRefreshTokens() {
  fs.readFile('./object.json', async function(err, data) {
    if (err) return;
    let users;
    try {
      users = JSON.parse(data);
      if (!Array.isArray(users)) {
        users = [];
      }
    } catch (e) {
      users = [];
    }

    for (const user of users) {
      await refreshToken(user.userID);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });
}

setInterval(autoRefreshTokens, 6 * 60 * 60 * 1000);

async function removeUnauthorizedUsers(guild) {
  return new Promise((resolve) => {
    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        resolve(0);
        return;
      }
      let users;
      try {
        users = JSON.parse(data);
        if (!Array.isArray(users)) {
          users = [];
        }
      } catch (e) {
        users = [];
      }

      const members = await guild.members.fetch();
      const filteredUsers = [];
      let removed = 0;

      for (const user of users) {
        const memberExists = members.has(user.userID);
        if (memberExists) {
          filteredUsers.push(user);
        } else {
          removed++;
          console.log(chalk.yellow(`[Clean] Removed ${user.username} from database (not in server)`));
        }
      }

      fs.writeFileSync('./object.json', JSON.stringify(filteredUsers, null, 2));
      resolve(removed);
    });
  });
}

function getAuthorizedStats(guild) {
  return new Promise((resolve) => {
    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        resolve({ online: 0, offline: 0, total: 0 });
        return;
      }

      const users = JSON.parse(data);
      let online = 0;
      let offline = 0;
      let total = 0;

      for (const user of users) {
        const member = guild.members.cache.get(user.userID);
        if (member) {
          total++;
          if (member.presence?.status === 'online' || member.presence?.status === 'idle' || member.presence?.status === 'dnd') {
            online++;
          } else {
            offline++;
          }
        }
      }

      resolve({ online, offline, total });
    });
  });
}

function generateKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function saveKey(keyData) {
  return new Promise((resolve, reject) => {
    fs.readFile('./keys.json', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const keys = JSON.parse(data);
      keys.push(keyData);
      fs.writeFile('./keys.json', JSON.stringify(keys, null, 2), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function getKey(keyCode) {
  return new Promise((resolve) => {
    fs.readFile('./keys.json', (err, data) => {
      if (err) {
        resolve(null);
        return;
      }
      const keys = JSON.parse(data);
      const key = keys.find(k => k.code === keyCode);
      resolve(key || null);
    });
  });
}

function updateKey(keyCode, updates) {
  return new Promise((resolve, reject) => {
    fs.readFile('./keys.json', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const keys = JSON.parse(data);
      const keyIndex = keys.findIndex(k => k.code === keyCode);
      if (keyIndex === -1) {
        resolve(false);
        return;
      }
      keys[keyIndex] = { ...keys[keyIndex], ...updates };
      fs.writeFile('./keys.json', JSON.stringify(keys, null, 2), (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  });
}

function deleteKey(keyCode) {
  return new Promise((resolve, reject) => {
    fs.readFile('./keys.json', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const keys = JSON.parse(data);
      const keyIndex = keys.findIndex(k => k.code === keyCode);
      if (keyIndex === -1) {
        resolve(false);
        return;
      }
      keys.splice(keyIndex, 1);
      fs.writeFile('./keys.json', JSON.stringify(keys, null, 2), (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  });
}

function getUserCredits(userId) {
  return new Promise((resolve) => {
    fs.readFile('./credits.json', (err, data) => {
      if (err) {
        resolve({ online: 0, offline: 0 });
        return;
      }
      const credits = JSON.parse(data);
      resolve(credits[userId] || { online: 0, offline: 0 });
    });
  });
}

function updateUserCredits(userId, online, offline) {
  return new Promise((resolve, reject) => {
    fs.readFile('./credits.json', (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const credits = JSON.parse(data);
      if (!credits[userId]) {
        credits[userId] = { online: 0, offline: 0 };
      }
      credits[userId].online = Math.max(0, (credits[userId].online || 0) + online);
      credits[userId].offline = Math.max(0, (credits[userId].offline || 0) + offline);

      fs.writeFile('./credits.json', JSON.stringify(credits, null, 2), (err) => {
        if (err) reject(err);
        else resolve(credits[userId]);
      });
    });
  });
}

const commands = [
  {
    name: 'help',
    description: 'Display all available commands'
  },
  {
    name: 'profile',
    description: 'View your credit balance'
  },
  {
    name: 'credits',
    description: 'Manage user credits (Owner only)',
    options: [
      {
        name: 'action',
        description: 'Action to perform',
        type: 3,
        required: true,
        choices: [
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' }
        ]
      },
      {
        name: 'user',
        description: 'User to manage credits for',
        type: 6,
        required: true
      },
      {
        name: 'amount',
        description: 'Amount of credits',
        type: 4,
        required: true
      },
      {
        name: 'type',
        description: 'Type of credits',
        type: 3,
        required: true,
        choices: [
          { name: 'online', value: 'online' },
          { name: 'offline', value: 'offline' }
        ]
      }
    ]
  },
  {
    name: 'key',
    description: 'Manage keys for member claiming',
    options: [
      {
        name: 'action',
        description: 'Action to perform',
        type: 3,
        required: true,
        choices: [
          { name: 'create', value: 'create' },
          { name: 'delete', value: 'delete' }
        ]
      },
      {
        name: 'amount',
        description: 'Number of members the key can claim (for create)',
        type: 4,
        required: false
      },
      {
        name: 'type',
        description: 'Type of members to claim (for create)',
        type: 3,
        required: false,
        choices: [
          { name: 'online', value: 'online' },
          { name: 'offline', value: 'offline' }
        ]
      },
      {
        name: 'key',
        description: 'Key code (for delete)',
        type: 3,
        required: false
      }
    ]
  },
  {
    name: 'redeem',
    description: 'Redeem a key to claim members',
    options: [
      {
        name: 'key',
        description: 'The key to redeem',
        type: 3,
        required: true
      },
      {
        name: 'server_id',
        description: 'Server ID to add members to',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'checkkey',
    description: 'Check key information',
    options: [
      {
        name: 'key',
        description: 'The key to check',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'checkserver',
    description: 'Check how many members can be added to a server',
    options: [
      {
        name: 'server_id',
        description: 'Server ID to check',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'links',
    description: 'Get OAuth2 and bot invite links'
  },
  {
    name: 'stock',
    description: 'View authorized user statistics'
  },
  {
    name: 'joinall',
    description: 'Add all authorized users to the server',
    options: [
      {
        name: 'amount',
        description: 'Number of users to add (default: all)',
        type: 4,
        required: false
      }
    ]
  },
  {
    name: 'join',
    description: 'Add users to a specific server',
    options: [
      {
        name: 'amount',
        description: 'Number of users to add',
        type: 4,
        required: true
      },
      {
        name: 'server_id',
        description: 'Target server ID',
        type: 3,
        required: true
      },
      {
        name: 'delay',
        description: 'Delay between each add (in milliseconds)',
        type: 4,
        required: true
      }
    ]
  },
  {
    name: 'refresh',
    description: 'Refresh all access tokens'
  },
  {
    name: 'clean',
    description: 'Remove users from database who are not in server'
  },
  {
    name: 'botinfo',
    description: 'Display bot information'
  },
  {
    name: 'authorise',
    description: 'Authorise tokens from a file (Owner only)',
    options: [
      {
        name: 'file',
        description: 'File containing tokens (e.g., tokens.txt)',
        type: 3,
        required: true
      }
    ]
  }
];

async function getOAuth2TokensFromUserToken(userToken) {
  try {
    const headers = { 
      'Authorization': userToken,
      'Content-Type': 'application/json'
    };

    const authorizeData = {
      permissions: '0',
      authorize: true,
      guild_id: null,
      integration_type: 0
    };

    const authorizeResponse = await axios.post(
      `https://discord.com/api/v10/oauth2/authorize?client_id=${kalash.client_id}&response_type=code&redirect_uri=${encodeURIComponent(kalash.redirect_uri)}&scope=identify%20guilds.join`,
      authorizeData,
      { headers }
    );

    if (!authorizeResponse.data || !authorizeResponse.data.location) {
      console.log(chalk.red('[OAuth2] No location in authorize response'));
      return null;
    }

    const location = authorizeResponse.data.location;
    const codeMatch = location.match(/code=([^&]+)/);

    if (!codeMatch) {
      console.log(chalk.red('[OAuth2] No code found in location'));
      return null;
    }

    const code = codeMatch[1];

    const FormData = require('form-data');
    const form = new FormData();
    form.append('client_id', kalash.client_id);
    form.append('client_secret', kalash.client_secret);
    form.append('grant_type', 'authorization_code');
    form.append('code', code);
    form.append('redirect_uri', kalash.redirect_uri);

    const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', form, {
      headers: form.getHeaders()
    });

    console.log(chalk.green(`[OAuth2] Token scope: ${tokenResponse.data.scope}`));

    return {
      access_token: tokenResponse.data.access_token,
      refresh_token: tokenResponse.data.refresh_token,
      scope: tokenResponse.data.scope
    };
  } catch (error) {
    console.log(chalk.red(`[OAuth2] Error: ${error.response?.status} - ${error.message}`));
    if (error.response?.data) {
      console.log(chalk.red(`[OAuth2] Response data: ${JSON.stringify(error.response.data)}`));
    }
    return null;
  }
}

async function authorizeTokensFromFile(fileName) {
  if (!fs.existsSync(`./${fileName}`)) {
    console.log(chalk.yellow(`[Auto-Auth] File ${fileName} not found, skipping...`));
    return;
  }

  try {
    const fileContent = fs.readFileSync(`./${fileName}`, 'utf8');
    const tokens = fileContent.split('\n').filter(token => token.trim().length > 0);

    if (tokens.length === 0) {
      console.log(chalk.yellow(`[Auto-Auth] No tokens found in ${fileName}`));
      return;
    }

    console.log(chalk.cyan(`[Auto-Auth] Found ${tokens.length} tokens in ${fileName}, converting to OAuth2...`));

    let authorised = 0;
    let failed = 0;
    let alreadyAuthorised = 0;
    let unverified = 0;

    const users = JSON.parse(fs.readFileSync('./object.json', 'utf8'));

    for (const token of tokens) {
      const trimmedToken = token.trim();

      try {
        const headers = { headers: { authorization: trimmedToken } };
        const userData = await axios.get('https://discordapp.com/api/users/@me', headers);

        const userId = userData.data.id;
        const isVerified = userData.data.verified;

        if (users.some((user) => user.userID === userId)) {
          alreadyAuthorised++;
          continue;
        }

        console.log(chalk.cyan(`[Auto-Auth] Processing ${userData.data.username}#${userData.data.discriminator} (Verified: ${isVerified})...`));

        if (!isVerified) {
          console.log(chalk.yellow(`[Auto-Auth] ⚠ Account not email verified, skipping OAuth2 conversion`));
          unverified++;

          const avatarURL = userData.data.avatar 
            ? `https://cdn.discordapp.com/avatars/${userData.data.id}/${userData.data.avatar}.png?size=4096`
            : `https://cdn.discordapp.com/embed/avatars/${userData.data.discriminator % 5}.png`;

          const newUser = {
            userID: userData.data.id,
            userIP: 'Auto Auth (Unverified)',
            avatarURL: avatarURL,
            username: userData.data.username + '#' + userData.data.discriminator,
            access_token: trimmedToken,
            refresh_token: null,
            verified: false,
            timestamp: Date.now()
          };

          users.push(newUser);
          continue;
        }

        const oauth2Tokens = await getOAuth2TokensFromUserToken(trimmedToken);

        if (!oauth2Tokens) {
          console.log(chalk.red(`[Auto-Auth] Failed to get OAuth2 tokens for ${userData.data.username}#${userData.data.discriminator}`));
          failed++;
          continue;
        }

        const avatarURL = userData.data.avatar 
          ? `https://cdn.discordapp.com/avatars/${userData.data.id}/${userData.data.avatar}.png?size=4096`
          : `https://cdn.discordapp.com/embed/avatars/${userData.data.discriminator % 5}.png`;

        const newUser = {
          userID: userData.data.id,
          userIP: 'Auto Auth OAuth2',
          avatarURL: avatarURL,
          username: userData.data.username + '#' + userData.data.discriminator,
          access_token: oauth2Tokens.access_token,
          refresh_token: oauth2Tokens.refresh_token,
          verified: true,
          timestamp: Date.now()
        };

        users.push(newUser);
        authorised++;

        console.log(chalk.green(`[Auto-Auth] ✓ Successfully converted ${userData.data.username}#${userData.data.discriminator}`));

        if (kalash.log_channel_id) {
          const logChannel = client.channels.cache.get(kalash.log_channel_id);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor(0x2F3136)
              .setTitle('Auto OAuth2 Authorization')
              .setThumbnail(avatarURL)
              .setDescription(
                `**Username:** \`${userData.data.username}#${userData.data.discriminator}\`\n` +
                `**User ID:** \`${userData.data.id}\`\n` +
                `**Method:** Auto-auth OAuth2 conversion\n` +
                `**Status:** Ready for guild joins`
              )
              .setTimestamp();
            logChannel.send({ components: logEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 }).catch(() => {});
          }
        }
      } catch (error) {
        console.log(chalk.red(`[Auto-Auth] Error processing token: ${error.message}`));
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    fs.writeFileSync('./object.json', JSON.stringify(users, null, 2));

    console.log(chalk.green(`[Auto-Auth] Complete: ${authorised} OAuth2 verified, ${unverified} unverified (cannot join), ${alreadyAuthorised} already authorized, ${failed} failed`));

    if (unverified > 0) {
      console.log(chalk.yellow(`[Auto-Auth] ⚠ ${unverified} accounts need email verification before they can join servers`));
      console.log(chalk.yellow(`[Auto-Auth] These accounts have been added but CANNOT be used for server joins until verified`));
    }

    if (authorised > 0 || unverified > 0) {
      setTimeout(() => updateStockEmbed().catch(console.error), 2000);
    }
  } catch (error) {
    console.error(chalk.red('[Auto-Auth] Error:'), error.message);
  }
}

async function updateStockEmbed() {
  try {
    const stockChannel = client.channels.cache.get(STOCK_CHANNEL_ID);
    if (!stockChannel) {
      console.log(chalk.yellow('[Stock] Stock channel not found'));
      return;
    }

    const users = JSON.parse(fs.readFileSync('./object.json', 'utf8'));
    
    const guild = client.guilds.cache.first();
    let onlineCount = 0;
    let offlineCount = 0;

    if (guild) {
      await guild.members.fetch();
      for (const user of users) {
        const member = guild.members.cache.get(user.userID);
        if (member) {
          if (member.presence?.status === 'online' || member.presence?.status === 'idle' || member.presence?.status === 'dnd') {
            onlineCount++;
          } else {
            offlineCount++;
          }
        } else {
          offlineCount++;
        }
      }
    } else {
      offlineCount = users.length;
    }

    const embed = new EmbedBuilder()
      .setTitle('Live Stock')
      .setDescription(
        `**Total Stock:** \`${users.length}\`\n` +
        `**Online:** \`${onlineCount}\`\n` +
        `**Offline:** \`${offlineCount}\``
      )
      .setColor(0x808080)
      .setTimestamp()
      .setFooter({ text: 'Auto-updates on auth/deauth events' });

    if (stockMessageId) {
      const oldMessage = await stockChannel.messages.fetch(stockMessageId).catch(() => null);
      if (oldMessage) {
        await oldMessage.edit({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        console.log(chalk.cyan('[Stock] Updated stock embed'));
        return;
      }
    }

    const messages = await stockChannel.messages.fetch({ limit: 100 });
    const oldStockMessages = messages.filter(msg => 
      msg.author.id === client.user.id && 
      msg.embeds.length > 0 && 
      msg.embeds[0].title === 'Live Stock'
    );

    for (const [, msg] of oldStockMessages) {
      await msg.delete().catch(() => {});
    }

    const newMessage = await stockChannel.send({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    stockMessageId = newMessage.id;
    console.log(chalk.green('[Stock] Created new stock embed'));
  } catch (error) {
    console.error(chalk.red('[Stock] Error updating stock embed:'), error.message);
  }
}

async function sendCompletionLog(data) {
  try {
    const logChannel = client.channels.cache.get(COMPLETION_LOG_CHANNEL_ID);
    if (!logChannel) {
      console.log(chalk.yellow('[Completion] Log channel not found'));
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Completion Log - ${data.command}`)
      .setDescription(`**Server:** ${data.serverName}\n**Server ID:** \`${data.serverId}\``)
      .addFields(
        { name: 'Command Type', value: `\`${data.command}\``, inline: true },
        { name: 'Requested By', value: `<@${data.userId}>`, inline: true },
        { name: 'Key Used', value: data.keyCode ? `\`${data.keyCode}\`` : 'N/A', inline: true },
        { name: 'Amount Requested', value: `\`${data.requested}\``, inline: true },
        { name: 'Successfully Added', value: `\`${data.success}\``, inline: true },
        { name: 'Failed', value: `\`${data.failed}\``, inline: true },
        { name: 'Already In Server', value: `\`${data.alreadyInServer}\``, inline: true },
        { name: 'Missing Members', value: `\`${data.missing}\``, inline: true },
        { name: 'Credits Refunded', value: data.creditsRefunded ? `\`${data.creditsRefunded}\`` : '\`0\`', inline: true }
      )
      .setColor(0x808080)
      .setTimestamp();

    if (data.keyType) {
      embed.addFields({ name: 'Key Type', value: `\`${data.keyType}\``, inline: true });
    }

    await logChannel.send({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    console.log(chalk.green('[Completion] Sent completion log'));
  } catch (error) {
    console.error(chalk.red('[Completion] Error sending log:'), error.message);
  }
}

client.on('ready', async () => {
  console.log(`${chalk.blue('BOT READY')}\n${chalk.green('->')} Connected as ${client.user.username}\n${chalk.green('->')} Prefix: ${kalash.prefix}\n${chalk.green('->')} Invite: https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`);

  const rest = new REST({ version: '10' }).setToken(kalash.token);

  try {
    console.log(chalk.yellow('Registering slash commands...'));
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(chalk.green(`Successfully registered ${commands.length} slash commands`));
  } catch (error) {
    console.error(chalk.red('Error registering commands:'), error);
  }

  await authorizeTokensFromFile('authtkn.txt');
  await updateStockEmbed();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  const publicCommands = ['redeem', 'checkkey', 'profile', 'help', 'links', 'botinfo'];

  if (!publicCommands.includes(commandName) && !kalash.owners.includes(interaction.user.id)) {
    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
  }

  if (commandName === 'help') {
    const isOwner = kalash.owners.includes(interaction.user.id);

    let description = '**User Management**\n' +
      '`/joinall` - Add authorized users to server\n' +
      '`/join` - Add users to specific server with delay\n' +
      '`/stock` - View user statistics\n' +
      '`/links` - Get OAuth2 links\n' +
      '`/checkserver` - Check available members for a server\n\n' +
      '**Key System (Public)**\n' +
      '`/key create` - Create a key (requires credits)\n' +
      '`/key delete` - Delete a key you created\n' +
      '`/redeem` - Redeem a key to claim members\n' +
      '`/checkkey` - Check key information\n' +
      '`/profile` - View your credit balance\n\n';

    if (isOwner) {
      description += '**Credit Management (Owner Only)**\n' +
        '`/credits add` - Add credits to a user\n' +
        '`/credits remove` - Remove credits from a user\n\n';
    }

    description += '**Utilities**\n' +
      '`/refresh` - Refresh access tokens\n' +
      '`/clean` - Remove unauthorized users\n' +
      '`/botinfo` - Bot information';

    const embed = new EmbedBuilder()
      .setTitle('OAuth2 Bot Commands')
      .setDescription(description)
      .setColor(0x2F3136)
      .setFooter({ text: `Prefix: ${kalash.prefix}` });

    await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  else if (commandName === 'profile') {
    const credits = await getUserCredits(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('Your Credit Balance')
      .setDescription(
        `**Online Credits:** \`${credits.online}\`\n` +
        `**Offline Credits:** \`${credits.offline}\`\n\n` +
        `*1 credit = 1 member*`
      )
      .setColor(0x2F3136)
      .setFooter({ text: 'Use credits to create keys with /key create' });

    await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, ephemeral: true });
  }

  else if (commandName === 'credits') {
    if (!kalash.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Only bot owners can manage credits.', ephemeral: true });
    }

    const action = options.getString('action');
    const user = options.getUser('user');
    const amount = options.getInteger('amount');
    const type = options.getString('type');

    if (amount <= 0) {
      return interaction.reply({ content: 'Amount must be greater than 0.', ephemeral: true });
    }

    const onlineChange = type === 'online' ? (action === 'add' ? amount : -amount) : 0;
    const offlineChange = type === 'offline' ? (action === 'add' ? amount : -amount) : 0;

    try {
      const newCredits = await updateUserCredits(user.id, onlineChange, offlineChange);

      const embed = new EmbedBuilder()
        .setTitle(`Credits ${action === 'add' ? 'Added' : 'Removed'}`)
        .setDescription(
          `**User:** <@${user.id}>\n` +
          `**Action:** \`${action}\`\n` +
          `**Amount:** \`${amount}\` ${type} credits\n\n` +
          `**New Balance:**\n` +
          `Online: \`${newCredits.online}\`\n` +
          `Offline: \`${newCredits.offline}\``
        )
        .setColor(action === 'add' ? 0x00FF00 : 0xFF0000);

      await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    } catch (error) {
      await interaction.reply({ content: 'Error updating credits. Please try again.', ephemeral: true });
    }
  }

  else if (commandName === 'key') {
    const action = options.getString('action');

    if (action === 'create') {
      const amount = options.getInteger('amount');
      const type = options.getString('type');

      if (!amount || !type) {
        return interaction.reply({ content: 'Please provide both amount and type for creating a key.', ephemeral: true });
      }

      if (amount <= 0) {
        return interaction.reply({ content: 'Amount must be greater than 0.', ephemeral: true });
      }

      const isOwner = kalash.owners.includes(interaction.user.id);

      if (!isOwner) {
        const credits = await getUserCredits(interaction.user.id);
        const requiredCredits = type === 'online' ? credits.online : credits.offline;

        if (requiredCredits < amount) {
          return interaction.reply({ 
            content: `Not enough credits! You have \`${requiredCredits}\` ${type} credits but need \`${amount}\`.`, 
            ephemeral: true 
          });
        }

        const onlineChange = type === 'online' ? -amount : 0;
        const offlineChange = type === 'offline' ? -amount : 0;
        await updateUserCredits(interaction.user.id, onlineChange, offlineChange);
      }

      const keyCode = generateKey();
      const keyData = {
        code: keyCode,
        amount: amount,
        type: type,
        createdBy: interaction.user.id,
        createdAt: Date.now(),
        redeemed: false,
        redeemedBy: null,
        redeemedAt: null
      };

      try {
        await saveKey(keyData);

        const embed = new EmbedBuilder()
          .setTitle('Key Created Successfully')
          .setDescription(
            `**Key Code:** \`${keyCode}\`\n` +
            `**Amount:** \`${amount}\` members\n` +
            `**Type:** \`${type}\`\n` +
            `**Created By:** <@${interaction.user.id}>\n` +
            `${!isOwner ? `**Credits Used:** \`${amount}\` ${type}` : '**Owner Key:** No credits used'}`
          )
          .setColor(0x2F3136)
          .setFooter({ text: 'Use /redeem to activate this key' })
          .setTimestamp();

        await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, ephemeral: true });
      } catch (error) {
        await interaction.reply({ content: 'Error creating key. Please try again.', ephemeral: true });
      }
    } else if (action === 'delete') {
      const keyCode = options.getString('key');

      if (!keyCode) {
        return interaction.reply({ content: 'Please provide a key code to delete.', ephemeral: true });
      }

      const key = await getKey(keyCode);

      if (!key) {
        return interaction.reply({ content: 'Invalid key code.', ephemeral: true });
      }

      const isOwner = kalash.owners.includes(interaction.user.id);
      const isKeyCreator = key.createdBy === interaction.user.id;

      if (!isOwner && !isKeyCreator) {
        return interaction.reply({ content: 'You can only delete keys that you created.', ephemeral: true });
      }

      try {
        const deleted = await deleteKey(keyCode);

        if (deleted) {
          const embed = new EmbedBuilder()
            .setTitle('Key Deleted Successfully')
            .setDescription(
              `**Key Code:** \`${keyCode}\`\n` +
              `**Amount:** \`${key.amount}\` members\n` +
              `**Type:** \`${key.type}\`\n` +
              `**Was Redeemed:** \`${key.redeemed ? 'Yes' : 'No'}\``
            )
            .setColor(0xFF0000)
            .setTimestamp();

          await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, ephemeral: true });
        } else {
          await interaction.reply({ content: 'Failed to delete key.', ephemeral: true });
        }
      } catch (error) {
        await interaction.reply({ content: 'Error deleting key. Please try again.', ephemeral: true });
      }
    }
  }

  else if (commandName === 'redeem') {
    await interaction.deferReply({ ephemeral: true });

    const keyCode = options.getString('key');
    const serverId = options.getString('server_id');

    const targetGuild = client.guilds.cache.get(serverId);
    if (!targetGuild) {
      return interaction.editReply({ content: `Could not find server with ID: \`${serverId}\`. Make sure the bot is in that server.` });
    }

    const key = await getKey(keyCode);

    if (!key) {
      return interaction.editReply({ content: 'Invalid key code.' });
    }

    if (key.redeemed) {
      return interaction.editReply({ 
        content: `This key has already been redeemed by <@${key.redeemedBy}> on <t:${Math.floor(key.redeemedAt / 1000)}:F>` 
      });
    }

    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        return interaction.editReply({ content: 'Error reading user data.' });
      }

      let users = JSON.parse(data);

      if (key.type === 'online') {
        const onlineUsers = [];
        for (const user of users) {
          const member = await targetGuild.members.fetch(user.userID).catch(() => null);
          if (member && (member.presence?.status === 'online' || member.presence?.status === 'idle' || member.presence?.status === 'dnd')) {
            onlineUsers.push(user);
          }
        }
        users = onlineUsers;
      }

      const amountToJoin = Math.min(key.amount, users.length);

      let success = 0;
      let failed = 0;
      let alreadyInServer = 0;
      const startTime = Date.now();

      const initialEmbed = new EmbedBuilder()
        .setTitle(`Redeeming Key for ${targetGuild.name}`)
        .setDescription(`Starting redemption process...\n\n${'[' + '-'.repeat(20) + ']'} 0%`)
        .addFields(
          { name: 'Server', value: `${targetGuild.name}`, inline: false },
          { name: 'Key Type', value: `\`${key.type}\``, inline: true },
          { name: 'Key Amount', value: `\`${key.amount}\``, inline: true },
          { name: 'Progress', value: `\`0/${amountToJoin}\``, inline: true },
          { name: 'Success', value: `\`0\``, inline: true },
          { name: 'Failed', value: `\`0\``, inline: true },
          { name: 'Already In Server', value: `\`0\``, inline: true },
          { name: 'Rate', value: `\`0.00/s\``, inline: true },
          { name: 'Elapsed', value: `\`0s\``, inline: true },
          { name: 'ETA', value: `\`Calculating...\``, inline: true }
        )
        .setColor(0x2F3136);

      await interaction.editReply({ components: initialEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      const updateInterval = setInterval(async () => {
        const processed = success + failed + alreadyInServer;
        const percentage = Math.round((processed / amountToJoin) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = processed > 0 ? (processed / elapsed).toFixed(2) : 0;
        const eta = processed > 0 && rate > 0 ? Math.round((amountToJoin - processed) / rate) : 0;
        
        const barLength = 20;
        const filledLength = Math.round((percentage / 100) * barLength);
        const progressBar = '[' + '='.repeat(filledLength) + '-'.repeat(barLength - filledLength) + ']';

        const updateEmbed = new EmbedBuilder()
          .setTitle(`Redeeming Key for ${targetGuild.name}`)
          .setDescription(`Processing members...\n\n${progressBar} ${percentage}%`)
          .addFields(
            { name: 'Server', value: `${targetGuild.name}`, inline: false },
            { name: 'Key Type', value: `\`${key.type}\``, inline: true },
            { name: 'Key Amount', value: `\`${key.amount}\``, inline: true },
            { name: 'Progress', value: `\`${processed}/${amountToJoin}\``, inline: true },
            { name: 'Success', value: `\`${success}\``, inline: true },
            { name: 'Failed', value: `\`${failed}\``, inline: true },
            { name: 'Already In Server', value: `\`${alreadyInServer}\``, inline: true },
            { name: 'Rate', value: `\`${rate}/s\``, inline: true },
            { name: 'Elapsed', value: `\`${elapsed}s\``, inline: true },
            { name: 'ETA', value: eta > 0 ? `\`${eta}s\`` : `\`Finalizing...\``, inline: true }
          )
          .setColor(0x2F3136);

        await interaction.editReply({ components: updateEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 }).catch(() => {});
      }, 3000);

      for (let i = 0; i < amountToJoin; i++) {
        const userEntry = users[i];
        const user = await client.users.fetch(userEntry.userID).catch(() => null);

        if (!user) {
          failed++;
          continue;
        }

        if (targetGuild.members.cache.get(userEntry.userID)) {
          alreadyInServer++;
          continue;
        }

        try {
          await targetGuild.members.add(user, { accessToken: userEntry.access_token });
          success++;
          console.log(chalk.green(`[Redeem] ✓ Added ${userEntry.username} to ${targetGuild.name}`));
        } catch (error) {
          console.log(chalk.red(`[Redeem] Failed to add ${userEntry.username}: ${error.code} - ${error.message}`));
          console.log(chalk.red(`[Redeem] Error details: ${JSON.stringify(error.response?.data || {})}`));
          if (error.code === 50025) {
            console.log(chalk.yellow(`[Redeem] Attempting to refresh token for ${userEntry.username}...`));
            const refreshed = await refreshToken(userEntry.userID);
            if (refreshed) {
              try {
                fs.readFile('./object.json', async (err, newData) => {
                  const updatedUsers = JSON.parse(newData);
                  const refreshedUser = updatedUsers.find(u => u.userID === userEntry.userID);
                  await targetGuild.members.add(user, { accessToken: refreshedUser.access_token });
                  success++;
                  console.log(chalk.green(`[Redeem] ✓ Added ${userEntry.username} after token refresh`));
                });
              } catch (refreshError) {
                console.log(chalk.red(`[Redeem] Failed after refresh: ${refreshError.message}`));
                failed++;
              }
            } else {
              console.log(chalk.red(`[Redeem] Token refresh failed for ${userEntry.username}`));
              failed++;
            }
          } else {
            failed++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearInterval(updateInterval);

      await updateKey(keyCode, {
        redeemed: true,
        redeemedBy: interaction.user.id,
        redeemedAt: Date.now()
      });

      const missing = key.amount - success - alreadyInServer;
      let creditsRefunded = 0;

      if (missing > 0) {
        const credits = JSON.parse(fs.readFileSync('./credits.json', 'utf8'));
        const userId = interaction.user.id;

        if (!credits[userId]) {
          credits[userId] = { online: 0, offline: 0 };
        }

        if (key.type === 'online') {
          credits[userId].online = (credits[userId].online || 0) + missing;
          creditsRefunded = missing;
        } else {
          credits[userId].offline = (credits[userId].offline || 0) + missing;
          creditsRefunded = missing;
        }

        fs.writeFileSync('./credits.json', JSON.stringify(credits, null, 2));
        console.log(chalk.cyan(`[Redeem] Refunded ${creditsRefunded} ${key.type} credits to ${interaction.user.tag}`));
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle('Key Redeemed Successfully')
        .setDescription(`Key: \`${keyCode}\``)
        .addFields(
          { name: 'Target Server', value: `${targetGuild.name}`, inline: false },
          { name: 'Key Amount', value: `\`${key.amount}\``, inline: true },
          { name: 'Key Type', value: `\`${key.type}\``, inline: true },
          { name: 'Attempted', value: `\`${amountToJoin}\``, inline: false },
          { name: 'Success', value: `\`${success}\``, inline: true },
          { name: 'Failed', value: `\`${failed}\``, inline: true },
          { name: 'Already In Server', value: `\`${alreadyInServer}\``, inline: true }
        )
        .setColor(0x2F3136)
        .setTimestamp();

      if (creditsRefunded > 0) {
        finalEmbed.addFields({
          name: 'Credits Refunded',
          value: `\`${creditsRefunded}\` ${key.type} credits\nWe are low on members, so we have refunded the missing credits to your account.`,
          inline: false
        });
      }

      await interaction.editReply({ components: finalEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      await sendCompletionLog({
        command: 'redeem',
        serverName: targetGuild.name,
        serverId: targetGuild.id,
        userId: interaction.user.id,
        keyCode: keyCode,
        keyType: key.type,
        requested: key.amount,
        success: success,
        failed: failed,
        alreadyInServer: alreadyInServer,
        missing: missing,
        creditsRefunded: creditsRefunded
      });
    });
  }

  else if (commandName === 'checkkey') {
    const keyCode = options.getString('key');
    const key = await getKey(keyCode);

    if (!key) {
      return interaction.reply({ content: 'Invalid key code.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Key Information')
      .setDescription(`**Key Code:** \`${keyCode}\``)
      .addFields(
        { name: 'Amount', value: `\`${key.amount}\` members`, inline: true },
        { name: 'Type', value: `\`${key.type}\``, inline: true },
        { name: 'Status', value: key.redeemed ? '`Redeemed`' : '`Available`', inline: true },
        { name: 'Created By', value: `<@${key.createdBy}>`, inline: true },
        { name: 'Created At', value: `<t:${Math.floor(key.createdAt / 1000)}:F>`, inline: true }
      )
      .setColor(key.redeemed ? 0xFF0000 : 0x00FF00);

    if (key.redeemed) {
      embed.addFields(
        { name: 'Redeemed By', value: `<@${key.redeemedBy}>`, inline: true },
        { name: 'Redeemed At', value: `<t:${Math.floor(key.redeemedAt / 1000)}:F>`, inline: true }
      );
    }

    await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, ephemeral: true });
  }

  else if (commandName === 'checkserver') {
    await interaction.deferReply({ ephemeral: true });

    const serverId = options.getString('server_id');

    const targetGuild = client.guilds.cache.get(serverId);
    if (!targetGuild) {
      return interaction.editReply({ content: `Could not find server with ID: \`${serverId}\`. Make sure the bot is in that server.` });
    }

    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        return interaction.editReply({ content: 'Error reading user data.' });
      }

      const users = JSON.parse(data);

      let onlineCount = 0;
      let offlineCount = 0;
      let alreadyInServer = 0;

      await targetGuild.members.fetch();

      for (const user of users) {
        const isInServer = targetGuild.members.cache.has(user.userID);

        if (isInServer) {
          alreadyInServer++;
          continue;
        }

        const member = targetGuild.members.cache.get(user.userID);
        const isOnline = member && (member.presence?.status === 'online' || member.presence?.status === 'idle' || member.presence?.status === 'dnd');

        if (isOnline) {
          onlineCount++;
        } else {
          offlineCount++;
        }
      }

      const totalAvailable = onlineCount + offlineCount;

      const embed = new EmbedBuilder()
        .setTitle(`Server Check: ${targetGuild.name}`)
        .setThumbnail(targetGuild.iconURL())
        .setDescription(
          `**Server ID:** \`${serverId}\`\n` +
          `**Server Members:** \`${targetGuild.memberCount}\`\n\n` +
          `**Available to Add:**\n` +
          `**Total:** \`${totalAvailable}\`\n` +
          `**Online:** \`${onlineCount}\`\n` +
          `**Offline:** \`${offlineCount}\`\n\n` +
          `**Already in Server:** \`${alreadyInServer}\`\n` +
          `**Total Authorized:** \`${users.length}\``
        )
        .setColor(0x2F3136)
        .setFooter({ text: 'These numbers represent authorized members that can be added' })
        .setTimestamp();

      await interaction.editReply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    });
  }

  else if (commandName === 'links') {
    const embed = new EmbedBuilder()
      .setTitle('OAuth2 Links')
      .setDescription(
        `**OAuth2 Link**\n\`\`\`${kalash.authLink}\`\`\`\n` +
        `**Bot Invite**\n\`\`\`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands\`\`\``
      )
      .setColor(0x2F3136);

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Bot Invite')
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`)
      );

    await interaction.reply({ components: embed.toComponents([row]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  else if (commandName === 'stock') {
    const guild =
      client.guilds.cache.get(STOCK_GUILD_ID) ||
      await client.guilds.fetch(STOCK_GUILD_ID).catch(() => null);

    if (!guild) {
      return interaction.reply({
        content: 'Stock guild not found or bot is not in that server.',
        ephemeral: true,
      });
    }

    await guild.members.fetch().catch(() => {});
    const stats = await getAuthorizedStats(guild);

    const embed = new EmbedBuilder()
      .setTitle('Stock')
      .setDescription(
        `**Total Stock:** \`${stats.total}\`\n` +
        `**Online Stock:** \`${stats.online}\`\n` +
        `**Offline Stock:** \`${stats.offline}\``
      )
      .setColor(0x2F3136);

    await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  else if (commandName === 'joinall') {
    await interaction.deferReply();

    const desiredAmount = options.getInteger('amount');

    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        return interaction.editReply({ content: 'Error reading user data.' });
      }

      const users = JSON.parse(data);
      const totalAuthorized = users.length;
      const amountToJoin = desiredAmount && desiredAmount < totalAuthorized ? desiredAmount : totalAuthorized;

      let success = 0;
      let failed = 0;
      let alreadyInServer = 0;
      const startTime = Date.now();

      const initialEmbed = new EmbedBuilder()
        .setTitle('Adding Users to Server')
        .setDescription(`Starting process...\n\n${'[' + '-'.repeat(20) + ']'} 0%`)
        .addFields(
          { name: 'Progress', value: `\`0/${amountToJoin}\``, inline: true },
          { name: 'Success', value: `\`0\``, inline: true },
          { name: 'Failed', value: `\`0\``, inline: true },
          { name: 'Already In Server', value: `\`0\``, inline: true },
          { name: 'Rate', value: `\`0.00/s\``, inline: true },
          { name: 'Elapsed', value: `\`0s\``, inline: true },
          { name: 'ETA', value: `\`Calculating...\``, inline: true },
          { name: 'Status', value: `\`Initializing\``, inline: true }
        )
        .setColor(0x2F3136);

      await interaction.editReply({ components: initialEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      const updateInterval = setInterval(async () => {
        const processed = success + failed + alreadyInServer;
        const percentage = Math.round((processed / amountToJoin) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = processed > 0 ? (processed / elapsed).toFixed(2) : 0;
        const eta = processed > 0 && rate > 0 ? Math.round((amountToJoin - processed) / rate) : 0;
        
        const barLength = 20;
        const filledLength = Math.round((percentage / 100) * barLength);
        const progressBar = '[' + '='.repeat(filledLength) + '-'.repeat(barLength - filledLength) + ']';

        const updateEmbed = new EmbedBuilder()
          .setTitle('Adding Users to Server')
          .setDescription(`Processing members...\n\n${progressBar} ${percentage}%`)
          .addFields(
            { name: 'Progress', value: `\`${processed}/${amountToJoin}\``, inline: true },
            { name: 'Success', value: `\`${success}\``, inline: true },
            { name: 'Failed', value: `\`${failed}\``, inline: true },
            { name: 'Already In Server', value: `\`${alreadyInServer}\``, inline: true },
            { name: 'Rate', value: `\`${rate}/s\``, inline: true },
            { name: 'Elapsed', value: `\`${elapsed}s\``, inline: true },
            { name: 'ETA', value: eta > 0 ? `\`${eta}s\`` : `\`Finalizing...\``, inline: true },
            { name: 'Status', value: `\`Adding members\``, inline: true }
          )
          .setColor(0x2F3136);

        await interaction.editReply({ components: updateEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 }).catch(() => {});
      }, 3000);

      for (let i = 0; i < amountToJoin; i++) {
        const userEntry = users[i];
        const user = await client.users.fetch(userEntry.userID).catch(() => null);

        if (!user) {
          failed++;
          continue;
        }

        if (interaction.guild.members.cache.get(userEntry.userID)) {
          alreadyInServer++;
          continue;
        }

        try {
          await interaction.guild.members.add(user, { accessToken: userEntry.access_token });
          success++;
          console.log(chalk.green(`[Join] Added ${userEntry.username} to server`));
        } catch (error) {
          console.log(chalk.red(`[Join] Failed to add ${userEntry.username}: ${error.code} - ${error.message}`));
          if (error.code === 50025) {
            console.log(chalk.yellow(`[Join] Attempting to refresh token for ${userEntry.username}...`));
            const refreshed = await refreshToken(userEntry.userID);
            if (refreshed) {
              try {
                fs.readFile('./object.json', async (err, newData) => {
                  const updatedUsers = JSON.parse(newData);
                  const refreshedUser = updatedUsers.find(u => u.userID === userEntry.userID);
                  await interaction.guild.members.add(user, { accessToken: refreshedUser.access_token });
                  success++;
                  console.log(chalk.green(`[Join] Added ${userEntry.username} after token refresh`));
                });
              } catch (refreshError) {
                console.log(chalk.red(`[Join] Failed after refresh: ${refreshError.message}`));
                failed++;
              }
            } else {
              console.log(chalk.red(`[Join] Token refresh failed for ${userEntry.username}`));
              failed++;
            }
          } else {
            failed++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearInterval(updateInterval);

      const finalEmbed = new EmbedBuilder()
        .setTitle('User Addition Complete')
        .addFields(
          { name: 'Desired Amount', value: `\`${desiredAmount || totalAuthorized}\``, inline: false },
          { name: 'Total Authorized', value: `\`${totalAuthorized}\``, inline: false },
          { name: 'Attempted', value: `\`${amountToJoin}\``, inline: false },
          { name: 'Success', value: `\`${success}\``, inline: true },
          { name: 'Failed', value: `\`${failed}\``, inline: true },
          { name: 'Already In Server', value: `\`${alreadyInServer}\``, inline: true }
        )
        .setColor(0x2F3136);

      await interaction.editReply({ components: finalEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      await sendCompletionLog({
        command: 'joinall',
        serverName: interaction.guild.name,
        serverId: interaction.guild.id,
        userId: interaction.user.id,
        keyCode: null,
        requested: desiredAmount || totalAuthorized,
        success: success,
        failed: failed,
        alreadyInServer: alreadyInServer,
        missing: 0,
        creditsRefunded: 0
      });
    });
  }

  else if (commandName === 'join') {
    await interaction.deferReply();

    const amount = options.getInteger('amount');
    const serverId = options.getString('server_id');
    const delay = options.getInteger('delay');

    const targetGuild = client.guilds.cache.get(serverId);
    if (!targetGuild) {
      return interaction.editReply({ content: `Could not find server with ID: \`${serverId}\`. Make sure the bot is in that server.` });
    }

    fs.readFile('./object.json', async function(err, data) {
      if (err) {
        return interaction.editReply({ content: 'Error reading user data.' });
      }

      const users = JSON.parse(data);
      const totalAuthorized = users.length;
      const amountToJoin = amount < totalAuthorized ? amount : totalAuthorized;

      let success = 0;
      let failed = 0;
      let alreadyInServer = 0;
      const startTime = Date.now();

      const initialEmbed = new EmbedBuilder()
        .setTitle(`Adding Users to ${targetGuild.name}`)
        .setDescription(`Starting process...\n\n${'[' + '-'.repeat(20) + ']'} 0%`)
        .addFields(
          { name: 'Server', value: `${targetGuild.name}`, inline: false },
          { name: 'Progress', value: `\`0/${amountToJoin}\``, inline: true },
          { name: 'Success', value: `\`0\``, inline: true },
          { name: 'Failed', value: `\`0\``, inline: true },
          { name: 'Already In Server', value: `\`0\``, inline: true },
          { name: 'Rate', value: `\`0.00/s\``, inline: true },
          { name: 'Delay', value: `\`${delay}ms\``, inline: true },
          { name: 'Elapsed', value: `\`0s\``, inline: true },
          { name: 'ETA', value: `\`Calculating...\``, inline: true }
        )
        .setColor(0x2F3136);

      await interaction.editReply({ components: initialEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      const updateInterval = setInterval(async () => {
        const processed = success + failed + alreadyInServer;
        const percentage = Math.round((processed / amountToJoin) * 100);
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = processed > 0 ? (processed / elapsed).toFixed(2) : 0;
        const eta = processed > 0 && rate > 0 ? Math.round((amountToJoin - processed) / rate) : 0;
        
        const barLength = 20;
        const filledLength = Math.round((percentage / 100) * barLength);
        const progressBar = '[' + '='.repeat(filledLength) + '-'.repeat(barLength - filledLength) + ']';

        const updateEmbed = new EmbedBuilder()
          .setTitle(`Adding Users to ${targetGuild.name}`)
          .setDescription(`Processing members...\n\n${progressBar} ${percentage}%`)
          .addFields(
            { name: 'Server', value: `${targetGuild.name}`, inline: false },
            { name: 'Progress', value: `\`${processed}/${amountToJoin}\``, inline: true },
            { name: 'Success', value: `\`${success}\``, inline: true },
            { name: 'Failed', value: `\`${failed}\``, inline: true },
            { name: 'Already In Server', value: `\`${alreadyInServer}\``, inline: true },
            { name: 'Rate', value: `\`${rate}/s\``, inline: true },
            { name: 'Delay', value: `\`${delay}ms\``, inline: true },
            { name: 'Elapsed', value: `\`${elapsed}s\``, inline: true },
            { name: 'ETA', value: eta > 0 ? `\`${eta}s\`` : `\`Finalizing...\``, inline: true }
          )
          .setColor(0x2F3136);

        await interaction.editReply({ components: updateEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 }).catch(() => {});
      }, 3000);

      for (let i = 0; i < amountToJoin; i++) {
        const userEntry = users[i];
        const user = await client.users.fetch(userEntry.userID).catch(() => null);

        if (!user) {
          failed++;
          continue;
        }

        if (targetGuild.members.cache.get(userEntry.userID)) {
          alreadyInServer++;
          continue;
        }

        try {
          await targetGuild.members.add(user, { accessToken: userEntry.access_token });
          success++;
          console.log(chalk.green(`[Join] Added ${userEntry.username} to ${targetGuild.name}`));
        } catch (error) {
          console.log(chalk.red(`[Join] Failed to add ${userEntry.username}: ${error.code} - ${error.message}`));
          if (error.code === 50025) {
            console.log(chalk.yellow(`[Join] Attempting to refresh token for ${userEntry.username}...`));
            const refreshed = await refreshToken(userEntry.userID);
            if (refreshed) {
              try {
                fs.readFile('./object.json', async (err, newData) => {
                  const updatedUsers = JSON.parse(newData);
                  const refreshedUser = updatedUsers.find(u => u.userID === userEntry.userID);
                  await targetGuild.members.add(user, { accessToken: refreshedUser.access_token });
                  success++;
                  console.log(chalk.green(`[Join] Added ${userEntry.username} after token refresh`));
                });
              } catch (refreshError) {
                console.log(chalk.red(`[Join] Failed after refresh: ${refreshError.message}`));
                failed++;
              }
            } else {
              console.log(chalk.red(`[Join] Token refresh failed for ${userEntry.username}`));
              failed++;
            }
          } else {
            failed++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, delay));
      }

      clearInterval(updateInterval);

      const finalEmbed = new EmbedBuilder()
        .setTitle('User Addition Complete')
        .addFields(
          { name: 'Target Server', value: `${targetGuild.name}`, inline: false },
          { name: 'Requested Amount', value: `\`${amount}\``, inline: false },
          { name: 'Total Authorized', value: `\`${totalAuthorized}\``, inline: false },
          { name: 'Attempted', value: `\`${amountToJoin}\``, inline: false },
          { name: 'Success', value: `\`${success}\``, inline: true },
          { name: 'Failed', value: `\`${failed}\``, inline: true },
          { name: 'Already In Server', value: `\`${alreadyInServer}\``, inline: true }
        )
        .setColor(0x2F3136);

      await interaction.editReply({ components: finalEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      await sendCompletionLog({
        command: 'join',
        serverName: targetGuild.name,
        serverId: targetGuild.id,
        userId: interaction.user.id,
        keyCode: null,
        requested: amount,
        success: success,
        failed: failed,
        alreadyInServer: alreadyInServer,
        missing: 0,
        creditsRefunded: 0
      });
    });
  }

  else if (commandName === 'refresh') {
    await interaction.deferReply();
    await autoRefreshTokens();

    const embed = new EmbedBuilder()
      .setDescription('All access tokens have been refreshed successfully')
      .setColor(0x2F3136);

    await interaction.editReply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  else if (commandName === 'clean') {
    await interaction.deferReply();
    const removed = await removeUnauthorizedUsers(interaction.guild);

    const embed = new EmbedBuilder()
      .setDescription(`Removed \`${removed}\` users from database who are not in the server`)
      .setColor(0x2F3136);

    await interaction.editReply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  else if (commandName === 'botinfo') {
    const embed = new EmbedBuilder()
      .setTitle('Bot Information')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Bot Name', value: `${client.user.username}`, inline: true },
        { name: 'Bot ID', value: `${client.user.id}`, inline: true },
        { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
        { name: 'Developer', value: 'AxYc / Sruj_n', inline: false }
      )
      .setColor(0x2F3136);

    await interaction.reply({ components: embed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
  }

  else if (commandName === 'authorise') {
    if (!kalash.owners.includes(interaction.user.id)) {
      return interaction.reply({ content: 'Only bot owners can use this command.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const fileName = options.getString('file');

    if (!fs.existsSync(`./${fileName}`)) {
      return interaction.editReply({ content: `File \`${fileName}\` not found. Please upload the file to your Repl first.` });
    }

    try {
      const fileContent = fs.readFileSync(`./${fileName}`, 'utf8');
      const tokens = fileContent.split('\n').filter(token => token.trim().length > 0);

      if (tokens.length === 0) {
        return interaction.editReply({ content: 'No tokens found in the file.' });
      }

      const statusEmbed = new EmbedBuilder()
        .setTitle('Authorising Tokens')
        .setDescription(`Found \`${tokens.length}\` tokens in \`${fileName}\`\n\nProcessing...`)
        .setColor(0x2F3136);

      await interaction.editReply({ components: statusEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });

      let authorised = 0;
      let failed = 0;
      let alreadyAuthorised = 0;

      for (const token of tokens) {
        const trimmedToken = token.trim();

        try {
          const headers = { headers: { authorization: `Bearer ${trimmedToken}` } };
          const userData = await axios.get('https://discordapp.com/api/users/@me', headers);

          const userId = userData.data.id;

          fs.readFile('./object.json', function(err, data) {
            if (err) {
              failed++;
              return;
            }

            const users = JSON.parse(data);

            if (users.some((user) => user.userID === userId)) {
              alreadyAuthorised++;
              return;
            }

            const avatarURL = userData.data.avatar 
              ? `https://cdn.discordapp.com/avatars/${userData.data.id}/${userData.data.avatar}.png?size=4096`
              : `https://cdn.discordapp.com/embed/avatars/${userData.data.discriminator % 5}.png`;

            const newUser = {
              userID: userData.data.id,
              userIP: 'Manual Auth',
              avatarURL: avatarURL,
              username: userData.data.username + '#' + userData.data.discriminator,
              access_token: trimmedToken,
              refresh_token: null,
              timestamp: Date.now()
            };

            users.push(newUser);
            fs.writeFileSync('./object.json', JSON.stringify(users, null, 2));
            authorised++;

            if (kalash.log_channel_id) {
              const logChannel = client.channels.cache.get(kalash.log_channel_id);
              if (logChannel) {
                const logEmbed = new EmbedBuilder()
                  .setColor(0x2F3136)
                  .setTitle('Manual Token Authorization')
                  .setThumbnail(avatarURL)
                  .setDescription(
                    `**Username:** \`${userData.data.username}#${userData.data.discriminator}\`\n` +
                    `**User ID:** \`${userData.data.id}\`\n` +
                    `**Method:** Manual file import\n` +
                    `**Authorised By:** <@${interaction.user.id}>`
                  )
                  .setTimestamp();
                logChannel.send({ components: logEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
              }
            }
          });
        } catch (error) {
          failed++;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const finalEmbed = new EmbedBuilder()
        .setTitle('Token Authorization Complete')
        .setDescription(
          `**File:** \`${fileName}\`\n` +
          `**Total Tokens:** \`${tokens.length}\`\n\n` +
          `**Authorised:** \`${authorised}\`\n` +
          `**Already Authorised:** \`${alreadyAuthorised}\`\n` +
          `**Failed:** \`${failed}\``
        )
        .setColor(0x2F3136)
        .setFooter({ text: `Users can now join servers using: ${kalash.authLink}` })
        .setTimestamp();

      await interaction.editReply({ components: finalEmbed.toComponents([]), flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    } catch (error) {
      console.error('Error reading file:', error);
      await interaction.editReply({ content: 'Error reading the file. Please check the file format.' });
    }
  }
});

client.login(kalash.token).catch(() => {
  throw new Error(`TOKEN OR INTENT INVALID`);
});

app.listen(kalash.port, () => console.log('Server started on port ' + kalash.port));