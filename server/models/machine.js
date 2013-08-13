var Machine = require(__dirname + '/models').Machine
    , generatePassword = require('password-generator')
    , dl = require('delivery')
    , fs = require('fs');



//path to store image files
var IMAGE_FILEPATH = __dirname + '/../public/images/';

//reporting frequency in ms - the higher the number, the less frequent updates can be sent from machines
var FREQ = 5000;



//init delivery.js for file transfer from machines
function initDelivery( _id, socket ){
    //set up file transfer listener through Delivery.js
    console.log("\n\n\nINITIALIZE DELIVERY");
    var delivery = dl.listen(socket);

    //listener for new file recieved
    delivery.on('receive.success',function(file){

      console.log('received file from machine with _id: ' + _id);

      //save file locally
      fs.writeFile( IMAGE_FILEPATH + file.name, file.buffer, function(err){
        if(err){
          console.log('File could not be saved, NOT writing to db');
        }else{
          console.log('File saved, now writing to db');

          Machine
            .findById(_id, function(err, mach){

                mach.images.addToSet( IMAGE_FILEPATH + file.name );

                mach.save(function(err){
                    if(err){
                        console.log('error: machine.js::initDelivery() attempting to update machine with new file through delivery.js: '+ err);
                    }else{
                        console.log('Success: updated machine with new file through delivery.js');
                    }
                });
            });
        }
      });
    });
}

exports.initialize = function( config, socket ){

    Machine
        .findOne({ 'name': config.name })
        .exec(function(err, existing_machine){
            //machine is not yet in database
            if (err) {
                //create machine
                var pw = generatePassword(12, false);

                var new_machine = new Machine({
                    name: config.name,
                    password: pw
                });

                new_machine
                    .save(function(err, mach){
                        if(err){
                            console.log('Error: attempted to save new machine with msg:'+ err);
                            return false;
                        }else{  
                            console.log('Success: created new machine with password: ' + pw );
                            initDelivery( mach.id, socket );

                            //send confirmation to machine with _id and new password
                            socket.emit('confirm', {"id": mach.id, "freq": FREQ, "password": pw});
                        }
                    });

            }
            //machine is already in database
            else{
                console.log('existing machine with _id:' + existing_machine.id);
                if(existing_machine.password !== config.password){
                    console.log('Error: password mismatch');
                    console.log('Machine sent ' + config.password + ', database pw is ' + existing_machine.password);
                    return false;
                }
                console.log('Password match successful');

                initDelivery( existing_machine.id, socket );

                //send confirmation to existing machine with the database _id
                socket.emit('confirm', {"id": existing_machine.id, "freq": FREQ});
            }
        });

    socket.on('report', function(data) {
      console.log('receiving report from: '+ data.id );
    });

    return true;
}