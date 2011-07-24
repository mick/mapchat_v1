var express = require("express"),
    app = express.createServer(),
    cradle = require("cradle"),
    sys = require("sys"),
    geojs = require("geojs"),
    io = require("socket.io"),
    settings = require("./settings"),
    SimpleGeo = require("simplegeo-client").SimpleGeo;

var connection = new(cradle.Connection)(settings.COUCHDB_HOST, settings.COUCHDB_PORT, 
                                        {auth: settings.COUCHDB_AUTH});
var db = connection.database(settings.COUCHDB_DATABASE);

var sg = new SimpleGeo(settings.SIMPLEGEO_KEY,
                       settings.SIMPLEGEO_SECRET);

// keep subscriptions.
//   subscriptions have bounding boxes.
//   also a subid, a current callback, message queue, 
                                 
var subscriptions =  [];
//{id:<num>, 
// bounds:[{lat,lon}, {lat, lon}]}  (use geo point object from geonode?)
// callback:<function> or subscription id in socket?
// messages: [<>] might no be needed if socket io does this form me.

socket = io.listen(app);

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

app.get('/', function(req, res){                
        res.render('index.ejs', { layout: false});
    });
app.use('/static', express.static(__dirname + '/static')); 


mapchat = {
    subscriptions: [],
    subscribe:function(client, msg){

        bottomlatlng = new geojs.latLng(msg.bounds[0][1], msg.bounds[0][0]);
        toplatlng = new geojs.latLng(msg.bounds[1][1], msg.bounds[1][0]);
        bounds = new geojs.bounds(bottomlatlng, toplatlng);
        
        var allReadySubscribed = false;
        for(s in mapchat.subscriptions){
            if(mapchat.subscriptions[s].client.sessionId == client.sessionId){
                allReadySubscribed = true;

                //Set new bounds.
                mapchat.subscriptions[s].bounds = bounds
                break;                
            }
        }
        if(!allReadySubscribed){
            mapchat.subscriptions.push({client:client,
                                        bounds:bounds});
            mapchat.sendChatClusters(client);
        }
        bbox = bounds.toBoundsArray().join(",");
        db.spatial("geo/recentPoints", {"bbox":bbox},
            function(er, docs) {
                if(er){sys.puts("Error: "+sys.inspect(er)); return;}
                for(d in docs){
                    client.send({"type":"message", 
                                "geometry":docs[d].geometry, 
                                "date":docs[d].value.date,
                                "message":docs[d].value.message});
                }

            });

    },
    message: function(client, msg){

        // save message to the database
        msg.date = new Date();
        db.save(msg, function (err, res) {
                if(err){sys.puts("error: "+sys.inspect(err));}
            });

        for(s in mapchat.subscriptions){            
            sub = mapchat.subscriptions[s];
            
            //We dont need to send a message to the same client that sent the message.
            if(sub.client.sessionId != client.sessionId){

                //check see if the bounds match.
                point = new geojs.point(msg.geometry);
                if(sub.bounds.contains(point)){
                    sub.client.send({"type":"message", "geometry":msg.geometry, "message":msg.message});
                }else{
                    sys.puts("not in the box")
                }
            }
        }

    },
    sendChatClusters: function(client){   
        if(client != undefined){
            // Send to just the one client
            client.send({"type":"clusters", "clusters":mapchat.clusters});
        }else{
            // Send to all subscriptions
            for(s in mapchat.subscriptions){
                sub = mapchat.subscriptions[s];
                sub.client.send({"type":"clusters", "clusters":mapchat.clusters});
            }
        }
    },
    getChatClusters: function(){
        db.spatiallist("geo/proximity-clustering/recentPoints", {"bbox":"-180,-90,180,90", 
                                                                 "sort":"true",
                                                                 "limit":"5",
                                                                 "nopoints":"true"},
            function(er, docs) {
                if(er){sys.puts("Error: "+sys.inspect(er));return;}

                var doneFetchingContext = function(docswithcontext){
                    mapchat.clusters = docswithcontext;
                    mapchat.sendChatClusters();
                    setTimeout(mapchat.getChatClusters, (1000*600));
                }
                count = docs.length;
                for(d in docs){
                    (function(doc){
                        sg.getContextByLatLng(docs[d].center.coordinates[1], 
                                              docs[d].center.coordinates[0], 
                                              function(error,data,res){
                            var city = "",
                                state = "",
                                country = "";
                            for(f in data.features){
                                if(data.features[f].classifiers[0].category == "National"){
                                    country = data.features[f].name.replace("United States of America", "USA");
                                }else if(data.features[f].classifiers[0].category == "Subnational"){
                                    state = data.features[f].name;
                                }else if(data.features[f].classifiers[0].category == "Municipal"){
                                    city = data.features[f].name;
                                }else if(data.features[f].classifiers[0].category == "Urban Area"){
                                    city = data.features[f].name;
                                }
                            }
                            names = [];
                            if(city != ""){ names.push(city);}
                            if(state != ""){ names.push(state);}
                            if(country != ""){ names.push(country);}
                            doc.locationName = names.join(", ");
                            count--;
                            if(count === 0){doneFetchingContext(docs)};
                        });})(docs[d]);

                }


            });
    }
};

mapchat.getChatClusters();


app.listen(settings.PORT);