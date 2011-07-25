var socket = new io.Socket();
var map = null;
var chatboxes = [];
socket.connect();
socket.on('connect', function(){ console.log("connect"); });
socket.on('message', function(data){ 
        if(data.type == "message"){
            chat.recieveMessage(data);
        }else if(data.type == "clusters"){
            chat.displayChatClusters(data.clusters);
        }
 });
socket.on('disconnect', function(){ console.log("disconnect"); });

var chat = {
    sendMessage:function(){
        chatmsg = $("#message").val()
        $("#message").val("");
        var latlon = map.getCenter();
        var lat = latlon.lat();
        if(lat > 90){
            lat -= 180;
        }
        var lon = latlon.lng();
        if(lon > 180){
            lon -= 360;
        }
        var point = {"type":"Point", "coordinates":[lon, lat]};
        socket.send({action:"message", message:chatmsg,  geometry:point});
        chat.recieveMessage({message:chatmsg, geometry:point})
    },
    recieveMessage:function(data){
            latlon = new google.maps.LatLng(data.geometry.coordinates[1],data.geometry.coordinates[0]);
            var chatbox = new ChatOverlay(latlon, data.message, map, "", "", "http://a3.twimg.com/profile_images/1408706495/at-twitter_bigger_normal.png");
            chatbox.show();
            chatboxes.push(chatbox);
    },
    displayChatClusters: function(clusters){
        $("div#clusters ul").empty();
        for(c in clusters){
            center = [clusters[c].center.coordinates[1], clusters[c].center.coordinates[0]].join(",");
            image_url = "http://maps.google.com/maps/api/staticmap?center=" + 
                center + "&zoom=4&size=80x40&sensor=true"
            $li = $("<li><img src='"+image_url+"' /> <br /> <div class='location'>"+clusters[c].locationName+"</div></li>");
            $("div#clusters ul").append($li);
            $li.data("location", center);
            $li.click(function(e){
                    lat =$(this).data("location").split(",")[0];
                    lon = $(this).data("location").split(",")[1];
                    map.setCenter(new google.maps.LatLng(lat,lon));
                });
        }        
    }
};


$(document).ready(function(){
        $("#send").click(chat.sendMessage);

        $("textarea#message").keypress(function(e){
                var code = (e.keyCode ? e.keyCode : e.which);
                if(code == 13) { //Enter keycode
                    chat.sendMessage();
                    return false;
                }
            });
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {
                    initialLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
                    map.setCenter(initialLocation);
                });
        }
        
        var myLatlng = new google.maps.LatLng(40.397, -104.644);
        var myOptions = {
            zoom: 8,
            center: myLatlng,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map(jQuery("#map")[0], myOptions);

        google.maps.event.addListener(map, 'bounds_changed', function(){
                var mapbounds = map.getBounds();
                bounds = [[mapbounds.getSouthWest().lng(),
                           mapbounds.getSouthWest().lat()],
                          [mapbounds.getNorthEast().lng(),
                           mapbounds.getNorthEast().lat()]];
                socket.send({action:"subscribe", bounds:bounds});
                for(c in chatboxes){chatboxes[c].setMap(null);}
                chatboxes = [];
            });
    });



function ChatOverlay(latlon, message, map, name, locationName, profilePic) {

    // Now initialize all properties.
    this._latlon = latlon;
    this._map = map;
    this._message = message;
    this._name = name;
    this._locationName = locationName;
    this._profilePic = profilePic

    // We define a property to hold the image's
    // div. We'll actually create this div
    // upon receipt of the add() method so we'll
    // leave it null for now.
    this._div = null;

    // Explicitly call setMap() on this overlay
    this.setMap(map);
}

ChatOverlay.prototype = new google.maps.OverlayView();

ChatOverlay.prototype.onAdd = function() {

    // Create a new div that we will add to the map.
    var chatbox = $("<div class='chatmsg'><div>" + //<img src='"+this._profilePic+"' />" +
                    "<div class='username'>"+this._name+"</div><br />" +
                    "<div class='locationname'>"+this._locationName+"</div>"+
                    "</div><div class='spacer'></div>"+
                    "<div class='message'> "+this._message+"</div></div>");
    chatbox.css("position", "absolute");

    // This is the reference to our div.
    this._div = chatbox;
    // Have to add it to a map pane. in this case the overlay layer.
    var panes = this.getPanes();
    panes.overlayLayer.appendChild(chatbox[0]);
    this._div.fadeIn('fast');
};

ChatOverlay.prototype.draw = function() {

    //This function is called when the map is redrawn, such as when the use zooms or moves

    // So we can size and position the div we need to get the projection.
    var overlayProjection = this.getProjection();
    
    // We will convert our Lat Lon into a pixel position
    var point = overlayProjection.fromLatLngToDivPixel(this._latlon);
    var div = this._div;

    // We dynamically resize the overlay depending on zoom level to make
    // showing a lot of them not cover as much of the map
    width = 22 *(this.getMap().getZoom()/16)*10;
    height = 15 * (this.getMap().getZoom()/16)*10;
    div.css("width", width+"px");
    div.css("height", height+"px");

    // Set the poition of the div.
    div.css("left", point.x-(width/2) + 'px');
    div.css("top", point.y-height + 'px');
};

ChatOverlay.prototype.onRemove = function() {
    this._div.remove();
    this._div = null;
};
ChatOverlay.prototype.hide = function() {
    if (this._div) {
        this._div.hide();
    }
};

ChatOverlay.prototype.show = function() {
    if (this._div) {
        this._div.fadeIn('fast');
    }
};

/*ChatOverlay.prototype.toggle = function() {
    if (this.div_) {
        if (this.div_.style.visibility == "hidden") {
            this.show();
        } else {
            this.hide();
        }
    }
};

ChatOverlay.prototype.toggleDOM = function() {
    if (this.getMap()) {
        this.setMap(null);
    } else {
        this.setMap(this.map_);
    }
};*/
