const YTHandler = require("./src/youtube");

const axios = require('axios');
const parse = require('node-html-parser');
const express = require("express")
const cors = require('cors')
const bodyParser = require("body-parser")
const compression = require('compression');

const PORT = process.env.PORT || 31023
const app = express()
app.use(bodyParser.json( { limit: '20mb'} ))
app.use(bodyParser.urlencoded({ extended: true, limit: '20mb' }))
app.use(cors());
app.use(compression());

const head = {'user-agent': 'Mozilla5.0 (Windows NT 10.0; Win64; x64) AppleWebKit537.36 (KHTML, like Gecko) Chrome75.0.3770.142 Safari537.36'}    

var corsOptions = {
  origin: 'https://mchatx.org',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

//-----------------------------------------  SERVER HANDLER  -----------------------------------------
app.get('/ChatProxy', async function (req, res) {
  if (req.query.link) {
    switch(req.query.link.substring(0,3)){
      case "YT_":
        req.query.link = req.query.link.substring(3);
        YTHandler.MainGate(req, res);
        break;
      case "TW_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "TC_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "NL_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "NC_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "BL_":
        res.status(400).send("Unable to handle this stream link");
        break;
      default:
        return res.status(400).send("Unable to handle this stream link");
    }
  } else if (req.query.channel) {
    switch(req.query.channel.substring(0,3)){
      case "YT_":
        req.query.channel = req.query.channel.substring(3);
        var res2 = await axios.get("https://www.youtube.com/channel/" + req.query.channel+ "/live", {headers: head});
        let idx = res2.data.indexOf('"liveStreamabilityRenderer":{"videoId":"');
      
        if (idx == -1){
          return res.status(400).send("NOT LIVE");
        }
        idx += ('"liveStreamabilityRenderer":{"videoId":"').length;
      
        req.query.link = res2.data.substring(idx, res2.data.indexOf('","', idx));
        YTHandler.MainGate(req, res);
        break;
      case "TW_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "TC_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "NL_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "NC_":
        res.status(400).send("Unable to handle this stream link");
        break;
      case "BL_":
        res.status(400).send("Unable to handle this stream link");
        break;
      default:
        return res.status(400).send("Unable to handle this stream link");
    }
  } else {
    return res.status(400).send("NO ID TO STREAM");
  }
})

app.get('/ChannelLive', async function (req,res) {
  if (!req.query.ChannelID) {
    return res.status(400).send("NO CHANNEL ID");
  }

  var res2 = await axios.get("https://www.youtube.com/channel/" + req.query.ChannelID + "/live", {headers: head});
  let idx = res2.data.indexOf('"liveStreamabilityRenderer":{"videoId":"');

  if (idx == -1){
    return res.status(400).send("NOT LIVE");
  }
  idx += ('"liveStreamabilityRenderer":{"videoId":"').length;

  let vidID = res2.data.substring(idx, res2.data.indexOf('","', idx));
  return res.status(200).send(vidID);  
})

app.listen(PORT, async function () {
  setInterval(YTHandler.Pinger, 1000*10);
  console.log(`Server initialized on port ${PORT}`);
})