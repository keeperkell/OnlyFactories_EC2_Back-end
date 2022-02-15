// This file is meant to run alongside the server and MQTT broker
// to listen to the topics from the factory and update any 
// Database tables that are relevant. 

// RUN LISTENER WITH COMMAND 'sudo pm2 start MQTT_Listener.js'

const mqtt = require('mqtt');
const url = 'wss://onlyfactories.duckdns.org:9001';
let client = mqtt.connect(url);
const sql = require("./models/db.js");

client.on('connect', function(){
    client.subscribe('Factory/Echo');                           // test topic that will echo back a message
    client.subscribe('Factory/Inventory');                      // listen for messages about inventory
    client.subscribe('Factory/Status');                         // listen for messages about factory status
    client.subscribe('Factory/Job_notice');                     // listen for messages about Job updates

    console.log('Client has subscribed successfully');
})

// Get timestamp with dateRange being how many days prior you want 
// the date for. 
function getTimestamp(dateRange){
    // timestamp for current time
    let currentDate = new Date();
    if(dateRange){
        currentDate.setDate(currentDate.getDate() - dateRange);
    }

    let updated_at = currentDate.getFullYear() + '-' + (currentDate.getMonth()+1) + '-'
            + currentDate.getDate() + ' ' + currentDate.getHours() + ':'
            + currentDate.getMinutes() + ':' + currentDate.getSeconds();
    
    return updated_at;
}

// When the client receives any message
client.on('message', function(topic, message){

    //if ordar status message is received
    if(topic === 'Factory/Echo'){
        console.log("Echo message Received")
        console.log(message)
    }
    else{
        var msg = JSON.parse(message);

        // If an inventory message is received, parse the JSON message
        // and count red, blue, white quantities. Create new timestamp 
        // and inventory object to send to DB
        if(topic == 'Factory/Inventory'){

            // init red, blue, white vars
            let r = 0;
            let b = 0;
            let w = 0;

            for(let i = 0; i < 3; i++){
                for(let j = 0; j < 3; j++){
                    switch(msg.Inventory[i][j]){
                        case 'red':
                            r += 1;
                            break;
                        case 'blue':
                            b += 1;
                            break;
                        case 'white':
                            w += 1;
                            break;
                        default:
                            break;
                    }
                }
            }

            let inventoryDetails = {
                quantityRed: r,
                quantityBlue: b,
                quantityWhite: w,
                updated_at: getTimestamp()
            }

            sql.query("UPDATE Inventory SET ?", inventoryDetails, (err, res) =>{
                if (err){
                    console.log("error: ", err);
                }
        
                console.log("Inventory updated: ", {quantityRed: res.quantityRed, ...inventoryDetails});
            });
            
        }
        //
        // IF FACTORY STATUS NOTICE MESSAGE IS RECEIVED
        //
        if(topic == 'Factory/Status'){

            let factoryStatusDetails = {
                factory_status: msg.factory_status,
                current_job: msg.current_job,
                job_queue_len: msg.job_queue_len,
                updated_at: getTimestamp()
            }

            sql.query("UPDATE FactoryStatus SET ?", factoryStatusDetails, (err, res) =>{
                if (err){
                    console.log("error: ", err);
                }
        
                console.log("Factory Status updated: ", {factory_status: res.factory_status, ...factoryStatusDetails});
            });
        }

        //
        // IF JOB STATUS NOTICE MESSAGE IS RECEIVED
        //
        if(topic == 'Factory/Job_notice'){
            console.log("Job Notice received")

            jobID = msg.jobID;

            jobUpdateDetails = {

            }

            sql.query(`UPDATE FactoryJobs SET ? WHERE jobID = ${jobID}`, factoryStatusDetails, (err, res) =>{
                if (err){
                    console.log("error: ", err);
                }
        
                console.log("Factory Status updated: ", {factory_status: res.factory_status, ...factoryStatusDetails});
            });

            console.log(msg);
        }
    }
});