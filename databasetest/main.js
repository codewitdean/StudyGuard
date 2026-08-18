const {Client}=require('pg')

const con =new Client(
   {
     host:"localhost",
     user: "postgres",
     port:5432,
     password:"thenewman",
     database:"test"
   }
)

con.connect().then(()=>console.log("Connected to post"))
con