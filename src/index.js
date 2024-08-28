const puppeteer = require('puppeteer-core');
const _cliProgress = require('cli-progress');
const spintax = require('mel-spintax');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
require("./welcome");
let spinner = require("./step");
let utils = require("./utils");
let qrcode = require('qrcode-terminal');
let path = require("path");
let argv = require('yargs').argv;
let constants = require("./constants");
let configs = require("../bot");
let fs = require("fs");
const fetch = require("node-fetch");
const FormData = require("form-data");
const { lt } = require('semver');
const mime = require('mime');
const moment = require('moment')
// only when server object is there in bot.json
// take parameter from json 
// only after authentication success from whatsapp
const graphicalInterface = require('./server/server')

let appconfig = null;

async function Main() {
    try {
        await downloadAndStartThings();
        //await checkForUpdate();

        console.log("WBOT is ready !! Let those message come.");
    }
    catch (e) {
        console.error("\nLooks like you got an error. " + e);
        // TODO : Not working on windows, so commenting this screenshot feature
        // try {
        //     let page;
        //     page.screenshot({ path: path.join(process.cwd(), "error.png") })
        // } 
        // catch (s) {
        //     console.error("Can't create shreenshot, X11 not running?. " + s);
        // }
        console.warn(e);
        //console.error("Don't worry errors are good. They help us improve. A screenshot has already been saved as error.png in current directory. Please mail it on vasani.arpit@gmail.com along with the steps to reproduce it.\n");
        throw e;
    }

    /**
     * If local chrome is not there then this function will download it first. then use it for automation. 
     */
    async function downloadAndStartThings() {
        appconfig = await utils.externalInjection("bot.json");
        appconfig = JSON.parse(appconfig);

        spinner.start("Downloading chromium\n");
        
        const browserFetcher = puppeteer.createBrowserFetcher({ platform: process.platform, path: process.cwd() });
        const progressBar = new _cliProgress.Bar({}, _cliProgress.Presets.shades_grey);

        progressBar.start(100, 0);
        const revisionInfo = await browserFetcher.download("1313161", (download, total) => {
            var percentage = (download * 100) / total;
            progressBar.update(percentage);
        });
        progressBar.update(100);

        spinner.stop("Downloading chromium ... done!");
        spinner.start("Launching browser\n");

        var pptrArgv = [];
        if (argv.proxyURI) {
            pptrArgv.push('--proxy-server=' + argv.proxyURI);
        }
        
        const extraArguments = Object.assign({});
        extraArguments.userDataDir = constants.DEFAULT_DATA_DIR;

        const client = new Client({
            puppeteer: {
                executablePath: revisionInfo.executablePath,
                defaultViewport: null,
                headless: appconfig.appconfig.headless,
                devtools: false,
                args: [...pptrArgv], ...extraArguments
            }
        });

        if (argv.proxyURI) {
            spinner.info("Using a Proxy Server");
        }

        client.on('loading_screen', (percent, message) => {
            console.log('LOADING SCREEN', percent, message);
        });

        client.on('qr', (qr) => {
            // Generate and scan this code with your phone
            console.log('QR RECEIVED', qr);
            qrcode.generate(qr, { small: true });
        });

        client.on('ready', async () => {
            //DISABLE: The Graphical Interface is not neccessary for now.
            // spinner.info('WBOT is spinning up!');
            // await utils.delay(5000);

            // let server = appconfig.appconfig.server;
            // if (server) {
            //     //Graphical interface to edit bot.json
            //     const USERNAME = server.username;
            //     const PASSWORD = server.password;
            //     const PORT = server.port;

            //     graphicalInterface(USERNAME, PASSWORD, PORT);
            // }

            //TODO: if replyUnreadMsg is true then get the unread messages and reply to them.
        });

        client.on('authenticated', () => {
            spinner.info('AUTHENTICATED');
        });

        client.on('auth_failure', msg => {
            // Fired if session restore was unsuccessful
            console.error('AUTHENTICATION FAILURE', msg);
        });

        client.on('message_create', async msg => {
            //DISABLE: Remove messages.json
            // const messages = require(path.resolve('messages.json'));
            // msg.timestamp = moment().format('DD/MM/YYYY HH:mm');
            // msg._data['chatName'] = chat.name
            // messages.push(msg)
            // fs.writeFileSync(path.resolve('messages.json'), JSON.stringify(messages, null, 2));

            //DISABLE: Does not neccessary check for media
            // if it is a media message then download the media and save it in the media folder
            // if (msg.hasMedia && configs.appconfig.downloadMedia) {
            //     console.log("Message has media. downloading");
            //     const media = await msg.downloadMedia()
            //     // checking if director is present or not
            //     if (!fs.existsSync(path.join(process.cwd(), "receivedMedia"))) {
            //         fs.mkdirSync(path.join(process.cwd(), "receivedMedia"));
            //     }

            //     if (media) {
            //         // write the data to a file
            //         let extension = mime.getExtension(media.mimetype)
            //         fs.writeFileSync(path.join(process.cwd(), "receivedMedia", msg.from + msg.id.id + "." + extension), media.data, 'base64')
            //         console.log("Media has been downloaded");
            //     } 
            //     else {
            //         console.log("There was an issue in downloading the media");
            //     }
            // } 
            // else {
            //     console.log("Message doesn't have media or it is not enabled in bot.config.json");
            // }


            if (msg.body.length != 0) {
                //TODO: reply according to the bot.config.json
                await smartReply({ msg, client });
                //TODO: call the webhook
            }
        });

        await client.initialize();

        spinner.stop("Launching browser ... done!");

        // When the settings file is edited multiple calls are sent to function. This will help
        // to prevent from getting corrupted settings data
        let timeout = 5000;

        // Register a filesystem watcher
        fs.watch(constants.BOT_SETTINGS_FILE, (event, filename) => {
            setTimeout(async () => {
                console.log("Settings file has been updated. Reloading the settings");
                configs = JSON.parse(fs.readFileSync(path.join(process.cwd(), "bot.json")));
                appconfig = await utils.externalInjection("bot.json");
                appconfig = JSON.parse(appconfig);
            }, timeout);
        });
    }
}

async function getResponse(msg, message) {
    function greetings() {
        let date = new Date();
        hour = date.getHours();

        if (hour >= 0 && hour < 12) {
            return "Good Morning";
        }

        if (hour >= 12 && hour < 18) {
            return "Good evening";
        }

        if (hour >= 18 && hour < 24) {
            return "Good night";
        }
    }

    let response = "";
    if (message !== undefined)
        response = spintax.unspin(message);

    // Adding variables: 
    response = response.replace('[#name]', msg._data.notifyName)
    response = response.replace('[#greetings]', greetings())
    response = response.replace('[#phoneNumber]', msg.from.split("@")[0])

    return response;
}

async function sendReply({ msg, client, data, noMatch }) {
    let globalWebhook = appconfig.appconfig.webhook;

    if (noMatch) {
        if (appconfig.noMatch.length != 0) {
            let response = await getResponse(msg, appconfig.noMatch);
            
            if (!configs.appconfig.quoteMessageInReply) {
                await client.sendMessage(msg.from, response);
            }
            else {
                await msg.reply(response);
            }
            //await processWebhook({ msg, client, webhook: globalWebhook });
        }
        
        return;
    }

    // console.log(`msg => `, msg);
    // console.log(`client => `, client);
    // console.log(`data => `, data);

    if (data.hasOwnProperty('webhook') && data.webhook.length > 0) {
        const webhookStatus = await processWebhook({ msg, client, webhookName: data.webhookName, webhook: data.webhook });
        if (!webhookStatus) return;
    }
    //DISABLE: Global webhook is not neccessary for now
    // const globalWebhookStatus = await processWebhook({ msg, client, webhook: globalWebhook });
    // if (!globalWebhookStatus) return;

    let response = await getResponse(msg, data.response);

    if (data.afterSeconds) {
        await utils.delay(data.afterSeconds * 1000);
    }

    if (data.file) {
        var captionStatus = data.responseAsCaption;

        // We consider undefined responseAsCaption as a false
        if (captionStatus == undefined) {
            captionStatus = false;
        }

        files = data.file
        if (Array.isArray(files)) {
            files.forEach(file => {
                sendFile(file)
            })
        }
        else {
            sendFile(files)
        }

        if (!captionStatus) {
            if (!configs.appconfig.quoteMessageInReply) {
                await client.sendMessage(msg.from, response);
            }
            else {
                await msg.reply(response);
            }
        }
        // if responseAsCaption is true, send image with response as a caption
        // else send image and response seperately
    } 
    else {
        if (!configs.appconfig.quoteMessageInReply) {
            await client.sendMessage(msg.from, response);
        }
        else {
            await msg.reply(response);
        }
    }

    function sendFile(file) {
        if (captionStatus == true) {
            utils
                .getFileData(file)
                .then(async ({ fileMime, base64 }) => {
                    // send response in place of caption as a last argument in below function call
                    var media = new MessageMedia(
                        fileMime,
                        base64,
                        file
                    );

                    if (!configs.appconfig.quoteMessageInReply) {
                        await client.sendMessage(msg.from, media, { caption: response });
                    }
                    else {
                        const data = await msg.getChat();
                        
                        await msg.reply(media, data.id._serialized, { caption: response });
                    }
                })
                .catch((error) => {
                    console.log("Error in sending file\n" + error);
                });
        } 
        else {
            console.log("Either the responseAsCaption is undefined or false, Make it true to allow caption to a file");

            utils
                .getFileData(file)
                .then(async ({ fileMime, base64 }) => {
                    // send blank in place of caption as a last argument in below function call
                    var media = new MessageMedia(
                        fileMime,
                        base64,
                        file
                    );

                    if (!configs.appconfig.quoteMessageInReply) {
                        await client.sendMessage(msg.from, media);
                    }
                    else {
                        await msg.reply(media);
                    }
                })
                .catch((error) => {
                    console.log("Error in sending file\n" + error);
                })
        }
    }
}

async function processWebhook({ msg, client, webhookName, webhook }) {
    if (!webhook) return true;

    const bearerToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVc2VybmFtZSI6ImFwaWtleXdhYm90IiwiSWQiOiIyIiwiQ29udGFjdE5hbWUiOiJXQUJPVCIsIkNvbnRhY3RDb21wYW55IjoiUmFwaWR0ZWNoIiwiSXNBY3RpdmUiOiJUcnVlIiwiQ3JlYXRlQ2F0ZWdvcnkiOiJGYWxzZSIsIkNyZWF0ZVJvbGUiOiJGYWxzZSIsIkNyZWF0ZVRhc2siOiJUcnVlIiwiQ3JlYXRlVXBkYXRlVGFza0RldGFpbCI6IkZhbHNlIiwiQ3JlYXRlVXNlciI6IkZhbHNlIiwiRGVsZXRlQ2F0ZWdvcnkiOiJGYWxzZSIsIkRlbGV0ZVJvbGUiOiJGYWxzZSIsIkRlbGV0ZVRhc2siOiJGYWxzZSIsIkRlbGV0ZVRhc2tEZXRhaWwiOiJGYWxzZSIsIkRlbGV0ZVVzZXIiOiJGYWxzZSIsIkdldENhdGVnb3J5Tm9kZXMiOiJGYWxzZSIsIkdldEZpbGUiOiJGYWxzZSIsIkdldFJvbGVzIjoiRmFsc2UiLCJHZXRTeXN0ZW1GaWxlIjoiRmFsc2UiLCJHZXRUYXNrIjoiVHJ1ZSIsIkdldFRhc2tEZXRhaWwiOiJGYWxzZSIsIkdldFVzZXIiOiJGYWxzZSIsIk1pZ3JhdGVVc2VyIjoiRmFsc2UiLCJTZWFyY2hUYXNrcyI6IkZhbHNlIiwiU2VhcmNoVXNlcnMiOiJGYWxzZSIsIlNob3dEYXNoYm9hcmQiOiJGYWxzZSIsIlN5c3RlbUZpbGVzIjoiRmFsc2UiLCJTeXN0ZW1Mb2dzIjoiRmFsc2UiLCJVcGRhdGVDYXRlZ29yeSI6IlRydWUiLCJVcGRhdGVSb2xlIjoiRmFsc2UiLCJVcGRhdGVUYXNrIjoiVHJ1ZSIsIlVwZGF0ZVVzZXIiOiJGYWxzZSIsIlZhbGlkYXRlVXNlciI6IkZhbHNlIiwibmJmIjoxNzI0NzMzMjA0LCJleHAiOjE3MjQ4MTk2MDQsImlhdCI6MTcyNDczMzIwNH0.WCoBVheQW4tUb8J7fpv8cVyxC5rz8C9FAs9CrX9hk64';

    try {
        const data = await eval(webhookName + '();');
        const response = await data.json();

        //replying to the user based on response
        if (response && response.success) {
            response.replies.forEach(async (itemResponse) => {
                itemResponse = await getResponse(msg, itemResponse);

                if (!configs.appconfig.quoteMessageInReply) {
                    await client.sendMessage(msg.from, itemResponse);
                }
                else {
                    await msg.reply(itemResponse);
                }

                //sending files if there is any 
                if (itemResponse.files && itemResponse.files.length > 0) {
                    itemResponse.files.forEach(async (itemFile) => {

                        const mimeTypeMatch = itemFile.file.match(/^data:(.*?);/);

                        const base64Data = mimeTypeMatch ? itemFile.file.split(',')[1] : itemFile.file;

                        const mimeType = mimeTypeMatch ? itemFile.file.split(':')[1].split(';')[0] : "image/jpg";

                        var media = await new MessageMedia(
                            mimeType,
                            base64Data,
                            itemFile.name
                        );

                        if (!configs.appconfig.quoteMessageInReply) {
                            await client.sendMessage(msg.from, media);
                        }
                        else {
                            await msg.reply(media);
                        }
                    })
                }
            });

            return true;
        }
    }
    catch (e) {
        console.error("\nPlease contact your administrator. " + e);
        console.warn(e);
        return false;
    }

    async function CreateTicket() {
        const today = new Date();
        const chat = await client.getChatById(msg.from);
        const bodyChat = msg.body.split(":")[1];
    
        const formdata = new FormData();
        formdata.append("portalId", "1");
        formdata.append("description", bodyChat);
        formdata.append("status", "New");
        formdata.append("priority", "Normal");
        formdata.append("createdDate", today.toISOString().slice(0, 10));
        formdata.append("requesterName", chat.name);
        formdata.append("requesterPhone", chat.id.user);
        formdata.append("sendEmails", "false");
    
        const data = await fetch(webhook, {
            method: "POST",
            body: formdata,
            headers: {
                'Authorization': 'Bearer ' + bearerToken,
                // 'Content-Type': 'multipart/form-data; boundary=<calculated when request is sent>'
            }
        })
    
        return data;
    }

    async function GetTicket() {
        const chat = await client.getChatById(msg.from);
        const bodyChat = msg.body.split(":")[1];
        webhook = webhook + `?TaskId=${bodyChat.replaceAll(/\s/g,'')}&RequesterPhone=${chat.id.user}`;

        const data = await fetch(webhook, {
            method: "POST",
            headers: {
                'Authorization': 'Bearer ' + bearerToken,
                // 'Content-Type': 'multipart/form-data; boundary=<calculated when request is sent>'
            }
        })

        return data;
    }

    async function ResolvedTicket() {
        const chat = await client.getChatById(msg.from);
        const bodyChat = msg.body.split(":")[1];
        
        const formdata = new FormData();
        formdata.append("taskId", bodyChat);
        formdata.append("status", "Resolved");

        const data = await fetch(webhook, {
            method: "POST",
            body: formdata,
            headers: {
                'Authorization': 'Bearer ' + bearerToken,
                // 'Content-Type': 'multipart/form-data; boundary=<calculated when request is sent>'
            }
        })

        return data;
    }
}

async function smartReply({ msg, client }) {
    const data = msg?.body;
    const isFromMe = msg?._data.id.fromMe;
    const list = appconfig.bot;

    //Don't reply is sender is blocked
    const senderNumber = msg.from.split("@")[0]
    var blockedNumbers = appconfig.blocked
    var allowedNumbers = appconfig.allowed
    
    // check if blocked numnbers are there or not. 
    // if current number is init then return
    if (Array.isArray(blockedNumbers) && blockedNumbers.includes(senderNumber)) {
        //console.log("Message received but sender is blocked so will not reply.")
        return;
    }

    if (Array.isArray(allowedNumbers) && allowedNumbers.length > 0 && !allowedNumbers.includes(senderNumber)) {
        //console.log("Message received but user is not in allowed list so will not reply.")
        return;
    }

    // Don't do group reply if isGroupReply is off
    if (msg.id.participant && appconfig.appconfig.isGroupReply == false) {
        //console.log("Message received in group and group reply is off. so will not take any actions.");
        return;
    }

    let chat = await client.getChatById(msg.from);
    console.log(`Message ${msg.body} received in ${chat.name} chat`);

    var exactMatch = list.find((obj) =>
        obj.exact.find((ex) => ex == data.toLowerCase() && (isFromMe == (obj.onlyFromMe ?? false)))
    );
    if (exactMatch != undefined) {
        return sendReply({ msg, client, data: exactMatch });
    }

    var partialMatch = list.find((obj) =>
        obj.contains.find((ex) => data.toLowerCase().search(ex) > -1 && (isFromMe == (obj.onlyFromMe ?? false)))
    );
    if (partialMatch != undefined) {
        return sendReply({ msg, client, data: partialMatch });
    }

    // No match
    sendReply({ msg, client, data: null, noMatch: true });
}

async function checkForUpdate() {
    spinner.start("Checking for an Update...");
    // Using Github API (https://docs.github.com/en/rest/reference/repos#releases)
    // to get the releases data
    const url = "https://api.github.com/repos/vasani-arpit/WBOT/releases";
    const response = await fetch(url);

    // Storing data in form of JSON
    var data = await response.json();
    var latestVersion = data[0].tag_name;
    var latestVersionLink = `https://github.com/vasani-arpit/WBOT/releases/tag/${latestVersion}`;
    var myVersion = 'v' + require('../package.json').version;

    spinner.stop("Checking for an Update... Completed");

    if (lt(myVersion, latestVersion)) {
        console.log(`An Update is available for you.\nPlease download the latest version ${latestVersion} of WBOT from ${latestVersionLink}`);
    }
}

Main();