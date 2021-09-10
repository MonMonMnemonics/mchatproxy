const DeepLAPI = require("../DeepL.json");
const Constants = require("./Constants.json");
const axios = require('axios');
const request = require('request');
const FormData = require('form-data');
const WebSocket = require('ws');

const ReservedChannel = [
];

//-------------------------------------------------------- LISTENER HANDLER --------------------------------------------------------
var ListenerPack = [];
/*
    ListenerPack {
        ID: string // video ID
        TL: Boolean // AUTO TL OR NOT
        BoolPool: number Check if conenction errory before 
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
    var res2 = await axios.get("https://www.youtube.com/watch?v=" + vidID, {headers: head});

    let idx = res2.data.indexOf('<meta itemprop="channelId"');
    
    if (idx == -1) {
      return res.status(400);
    }

    idx = res2.data.indexOf('content="', idx);
    if (idx == -1) {
      return res.status(400);
    }
    idx += ('content="').length;
    let text = res2.data.substr(idx, res2.data.indexOf('">', idx) - idx);
    //if (!ReservedChannel.includes(text)) return res.status(400).send("NOT INCLUDED");
    
    if(res2.status != 200){
      return res.status(400);
    }
    
    var Key = KeySeeker('"INNERTUBE_API_KEY":"', res2.data);
    if (!Key){
      return res.status(400);
    }
    
    var ContTkn = KeySeeker('"continuation":"', res2.data);
    if (!ContTkn){
      return res.status(400);
    }
    
    var VisDt = KeySeeker('"visitorData":"', res2.data);
    if (!VisDt){
      return res.status(400);
    }
    
    var CVer = KeySeeker('"clientVersion":"', res2.data);
    if (!CVer){
      return res.status(400);
    }
    
    ListenerPack.push({
        Active: true,
        BoolPool: 0,
        ID: vidID,
        TL: TL,
        ConnList: [NewConn]
    })
    StartYTCPoll(Key, ContTkn, VisDt, CVer, 0, vidID);
  }

  req.on('close', () => {
    const idx = SeekID(vidID);
    if (idx != -1){
        ListenerPack[idx].ConnList = ListenerPack[idx].ConnList.filter(c => c.id !== newID);
        if (ListenerPack[idx].ConnList.length == 0){
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



exports.MainGate = async function (req, res) {
    if (req.query.link.indexOf("/") == -1){
        req.query.channel = req.query.link;
        request("https://frontendapi.twitcasting.tv/users/" + req.query.channel + "/latest-movie", function (error, response, body) {
            if (error){
              return res.status(400).send("NOT OK");
            }
        
            try {
                body = JSON.parse(body);    
            } catch (error) {
                return res.status(400).send("NOT OK");
            }
            
            if (!body.movie.is_on_live){
                return res.status(400).send("NOT LIVE");
            } else {
                req.query.link = body.movie.id;
                DivergencePoint(req, res);        
            }
        });
    } else {
        req.query.channel = req.query.link.split("/")[0];
        req.query.link = req.query.link.split("/")[1];
        DivergencePoint(req, res);
    }
}

function DivergencePoint(req, res) {
    var bodyFormData = new FormData();
    bodyFormData.append("movie_id", req.query.link);
    
    axios.post("https://twitcasting.tv/eventpubsuburl.php", bodyFormData, 
        {        
            headers: {
                "Authorization": "Basic dffdg",
                "Content-Type": "multipart/form-data; boundary=" + bodyFormData.getBoundary()
            }
        }
    ).then(function (response) {
        res.status(200).send("OK");
        const ws = new WebSocket(response.data.url);
        ws.onopen = function (event) {
			console.log("CONNECTED");
		};
        
        ws.onclose = function (event) {
            console.log("CLOSED");
        };
		
		ws.onmessage = function (event) {
            JSON.parse(event.data).forEach(e => {
                switch (e.type) {
                    case "gift":
                        console.log({
                            type: e.type,
                            author: e.sender.name,
                            screenName: e.sender.screenName,
                            thumbnailURL: e.sender.profileImage,
                            message: decodeURIComponent(e.message),
                            item: e.item
                        });
                        break;
                
                    case "comment":
                        /*
                        console.log({
                            type: e.type,
                            author: e.author.name,
                            screenName: e.author.screenName,
                            thumbnailURL: e.author.profileImage,
                            message: decodeURIComponent(e.message)
                        });
                        */
                        break;
                    
                    default:
                        console.log(e.type);
                        break;
                }
            });
		};
    }).catch(function (error) {
        console.log(error);
        return res.status(400).send("POST NOT OK");
    });


    /*
    if (!req.query.TL){
        AddListener(req, res);
      } else {
        if (req.query.channel){
          if (ReservedChannel.indexOf(req.query.channel) != -1){
            AddListener(req, res);
          } else {
            delete req.query.TL;
            AddListener(req, res);
          }      
        } else {
          delete req.query.TL;
          AddListener(req, res);
        }
    }
    */
}

//https://en.twitcasting.tv/kinnpatuhikaru/movie/700532969