var socket = new io.Socket("localhost");
var map = null;
socket.connect();
socket.on('connect', function(data){ console.log(data); });
socket.on('message', function(data){ console.log(data);
        if(data.type == "message"){
            
            latlon = new google.maps.LatLng(data.point[0],data.point[1]);
            var infowindow = new google.maps.InfoWindow({
                    content: data.message,
                    position:latlon
                });
            infowindow.open(map);
        }
 });
socket.on('disconnect', function(data){ console.log(data); });

var chat = {
    sendMessage:function(){
        chatmsg = $("#message").val()
        $("#message").val("");
        var latlon = map.getCenter();
        var point = [latlon.lat(), latlon.lng()];
        socket.send({action:"message", message:chatmsg,  point:point});
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
        
        var myLatlng = new google.maps.LatLng(-34.397, 150.644);
        var myOptions = {
            zoom: 8,
            center: myLatlng,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        map = new google.maps.Map(jQuery("#map")[0], myOptions);

        google.maps.event.addListener(map, 'bounds_changed', function(){
                var mapbounds = map.getBounds();
                bounds = [[mapbounds.getNorthEast().lat(),
                           mapbounds.getNorthEast().lng()],
                          [mapbounds.getSouthWest().lat(),
                           mapbounds.getSouthWest().lng()]];
                socket.send({action:"subscribe", bounds:bounds});
            });
    });
