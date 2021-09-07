const DeepLAPI = require("../DeepL.json");
const tmi = require('tmi.js');
const Constants = require("./Constants.json");

const ReservedChannel = [
];

//-------------------------------------------------------- LISTENER HANDLER --------------------------------------------------------
var ListenerPack = [];
/*
    ListenerPack {
        ID: string // video ID
        TL: Boolean // AUTO TL OR NOT
        BoolPool: number Check if conenction errory before 
        TMIClient: Client for listener,
        MsgBucket: Bucket to be emptied and processed every 2 seconds
        ConnList: [
            {
                id:
                TL:
                res:
            },
            ...
        ]
    }
*/

function SeekID(VidID){
    if (ListenerPack.length == 0){
        return (-1);
    }

    for (var i = 0; i < ListenerPack.length; i++){
        if (ListenerPack[i].ID == VidID){
            return (i);
        } else if ( i == ListenerPack.length - 1){
            return (-1);
        }
    }
}

async function AddListener(req, res){
  const vidID = req.query.link;

  var TL = false;
  if (req.query.TL){
    if (req.query.TL == "OK"){
        TL = true;
    }      
  }

  const newID = Date.now();
  const NewConn = {
      id: newID,
      TL: TL,
      res: res      
  };

  res.writeHead(200, Constants.Contheaders);
  res.flushHeaders();
  res.write("data: { \"flag\":\"Connect\", \"content\":\"CONNECTED TO SERVER\"}\n\n");

  var indextarget = SeekID(vidID);
  if (indextarget != -1){
      ListenerPack[indextarget].ConnList.push(NewConn);
      if (TL == true){
          ListenerPack[indextarget].TL = true;
      }
  } else {

    const client = new tmi.Client({
        connection: {
            reconnect: true,
            secure: true
        },
        channels: [ vidID ]
    });

    const Pack = {
        Active: true,
        BoolPool: 0,
        ID: vidID,
        TL: TL,
        TMIClient: client,
        MsgBucket: [],
        ConnList: [NewConn]
    }

    ListenerPack.push(Pack);
    
    client.on('message', (channel, tags, message, self) => {
        var TLContent = message;
        var em = "";
        if (tags.emotes){
            console.log("EMOTE!");
            Object.entries(tags.emotes).forEach(([id, positions]) => {
                const [start, end] = positions[0].split("-");
                if (em != ""){
                    em += "|";
                } 
                em += message.substr(start, end - start  + 1).replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
            });
        }

        TLContent = TLContent.replace(new RegExp(em, "g"), "");

        if (message != TLContent){
            console.log(em);
            console.log({
                message: message,
                TLContent: TLContent,
                emoteonly: tags["emote-only"]
            })
        }
        /*
        Pack.MsgBucket.push({
            author: tags["display-name"],
            badges: tags.badges,
            emotes: tags.emotes,
            message: message,
            TLContent: TLContent
        })
        */
    });
    
    client.connect();
  }

  req.on('close', () => {
    const idx = SeekID(vidID);
    if (idx != -1){
        ListenerPack[idx].ConnList = ListenerPack[idx].ConnList.filter(c => c.id !== newID);
        if (ListenerPack[idx].ConnList.length == 0){
            ListenerPack[idx].TMIClient.disconnect();
            ListenerPack.splice(idx, 1);
        } else if (TL == true) {
            if (ListenerPack[idx].ConnList.filter(c => c.TL == true).length == 0){
                ListenerPack[idx].TL = false;
            }
        }
        
    }
  });
}

function broadcastTL(idx, data){
    if (ListenerPack[idx]){
        ListenerPack[idx].ConnList.filter(c => c.TL == true).forEach(c => c.res.write("data:" + data + "\n\n"));
    }    
}

function broadcastNormal(idx, data){
    if (ListenerPack[idx]){
        ListenerPack[idx].ConnList.filter(c => c.TL != true).forEach(c => c.res.write("data:" + data + "\n\n"));
    }    
}

function broadcastAll(idx, data) {
    if (ListenerPack[idx]){
        ListenerPack[idx].ConnList.forEach(c => c.res.write("data:" + data + "\n\n"));
    }    
}


async function BroadcastDelete(CID, VID){
    if (CID != undefined){    
      //UCmRd9ZiaD41vCqfJ3K5JrpQ meta itemprop="name"
      var res = await axios.get("https://www.youtube.com/channel/" + CID, {headers: head});
      let idx = res.data.indexOf('<meta itemprop="name"');
      
      if (idx == -1) {
        return;
      }
  
      idx = res.data.indexOf('content="', idx);
      if (idx == -1) {
        return(400);
      }
      idx += ('content="').length;
      let text = res.data.substr(idx, res.data.indexOf('">', idx) - idx);
  
      idx = SeekID(VID);
      if (idx != -1){
        ListenerPack[idx].ConnList.forEach(c => {
          c.res.write("data: { \"flag\":\"DELETE\", \"Nick\":\"" + text + "\"}\n\n");
          c.res.flush();
        });
      }
    }
  }

function FlushCloseConnections(idx) {
    for(;ListenerPack[idx].ConnList.length != 0;){
        ListenerPack[idx].ConnList[0].res.write("data: { \"flag\":\"MSG Fetch Stop\", \"content\":\"MSG Fetch Stop\" }\n\n");
        ListenerPack[idx].ConnList[0].res.end();
        ListenerPack[idx].ConnList.splice(0, 1);
        if (ListenerPack[idx].ConnList.length == 0){
            ListenerPack.splice(idx, 1);
            break;
        }
    }
}

exports.Pinger = function() {
    for(i = 0; i < ListenerPack.length;){
        if (ListenerPack[i].Active){
            if (ListenerPack[i].ConnList.length == 0){
                ListenerPack.splice(i, 1);
            } else {
                ListenerPack[i].Active = false;
                ListenerPack[i].BoolPool = 0;
                i++;
            }
        } else {
            ListenerPack[i].BoolPool += 1;
            if (ListenerPack[i].BoolPool == 30){
                for(;ListenerPack[i].ConnList.length != 0;){
                    ListenerPack[i].ConnList[0].res.write("data: { \"flag\":\"timeout\", \"content\":\"Timeout\" }\n\n");
                    ListenerPack[i].ConnList[0].res.end();
                    ListenerPack[i].ConnList.splice(0, 1);
                    if (ListenerPack[i].ConnList.length == 0){
                        ListenerPack.splice(i, 1);
                        break;
                    }
                }
            } else {
                broadcastTL(i, "{}");
                broadcastNormal(i, "{}");
                i++;
            }
        }
    }
}
//======================================================== LISTENER HANDLER ========================================================

exports.MainGate = function (req, res) {
    AddListener(req, res);
    /*
    if (!req.query.TL){
        return (res.status(400).send("Twitch only available for translation"));
      } else {
        if (req.query.channel){
          if (ReservedChannel.indexOf(req.query.channel) != -1){
            AddListener(req, res);
          } else {
            return (res.status(400).send("Twitch only available for translation")); 
          }      
        } else {
          return (res.status(400).send("Twitch only available for translation"));
        }
    } 
    */ 
}