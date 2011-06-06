HOST = null; // localhost
PORT = 8012;

var fu = require("./fu"),
    sys = require("sys"),
    url = require("url"),
    qs = require("querystring"),
    geojs = require("../geojs");


// keep subscriptions.
//   subscriptions have bounding boxes.
//   also a subid, a current callback, message queue, 
                                 
var subscriptions =  [];
//{id:<num>, 
// bounds:[{lat,lon}, {lat, lon}]}  (use geo point object from geonode?)
// callback:<function> or subscription id in socket?
// messages: [<>] might no be needed if socket io does this form me.



//On message: check if it is with anyone bounding box (if so send it to them)
//save it to couchDB, add to message list, and flush message list to calc clustering.



fu.listen(Number(process.env.PORT || PORT), HOST);
                


socket = fu.socketio()

socket.on('connection', function(client){ 
        sys.puts("new client connect");

        client.on('message', function(msg){ 
                if(msg.action == "subscribe"){
                    mapchat.subscribe(this, msg);
                }else if(msg.action="message"){
                    mapchat.message(this,msg);
                }
            }); 
        client.on('disconnect', function(){ sys.puts("client disconnect"); }) 
    }); 

fu.get("/", fu.staticHandler("index.html"));
fu.get("/style.css", fu.staticHandler("style.css"));
fu.get("/client.js", fu.staticHandler("client.js"));
fu.get("/jquery-1.2.6.min.js", fu.staticHandler("jquery-1.2.6.min.js"));





mapchat = {
    subscriptions: [],
    subscribe:function(client, msg){

        //does socket it handle client to server json?


        bottomlat = msg.bounds[1][0];
        bottomlon = msg.bounds[1][1];

        toplatlng = new geojs.latLng(msg.bounds[0][0], msg.bounds[0][1]);
        bottomlatlng = new geojs.latLng(msg.bounds[1][0], msg.bounds[1][1]);
        bounds = new geojs.bounds(toplatlng, bottomlatlng);
        
        var allReadySubscribed = false;
        for(s in mapchat.subscriptions){
            if(mapchat.subscriptions[s].client.sessionId == client.sessionId){
                allReadySubscribed = true;

                //Set new bounds.
                mapchat.subscriptions[s].bounds = bounds
                sys.puts("new bounds set");
                break;                
            }
        }
        if(!allReadySubscribed){
            mapchat.subscriptions.push({client:client,
                                        bounds:bounds});
            sys.puts("client with bounds added.");
        }

    },
    message: function(client, msg){

        for(s in mapchat.subscriptions){            
            sub = mapchat.subscriptions[s];
            
            //We dont need to send a message to the same client that sent the message.
            if(sub.client.sessionId != client.sessionId){

                //check see if the bounds match.
                point = new geojs.point(new geojs.latLng(msg.point[0], msg.point[1]));
                if(sub.bounds.contains(point)){
                    sub.client.send({"type":"message", "point":msg.point, "message":msg.message});
                }else{
                    sys.puts("not in the box")
                }
            }
        }

    }

};
