const cors = require('cors'); //only necessary when you are not running clients on the server

const pg = require('pg');
const dbURI = "postgres://unplxlsntsqjnh:24a3c453d8a57d1eae786c132d85c5cfe8c53999e559e8c6194066153125e238@ec2-54-228-243-238.eu-west-1.compute.amazonaws.com:5432/dcrtq1esnnr3gs" + "?ssl=true";
const connstring = process.env.DATABASE_URL || dbURI;
const pool = new pg.Pool({ connectionString: connstring });

const secret = "frenchfriestastegood!"; //for tokens - should be stored as an environment variable
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const express = require('express');
const app = express(); //server-app

let logindata;

// middleware ------------------------------------
app.use(cors()); //allow all CORS requests
app.use(express.json()); //for extracting json in the request-body
app.use('/', express.static('client')); //for serving client files
app.use('/travels', protectEndpoints);
app.use('/expenses', protectEndpoints);

//function used for protecting endpoints ---------
function protectEndpoints(req, res, next) {

    let token = req.headers['authorization'];

    if (token) {
        try {
            logindata = jwt.verify(token, secret);
            next();
        } catch (err) {
            res.status(403).json({ msg: "Not a valid token" });
        }
    }
    else {
        res.status(403).json({ msg: "No token" });
    }
}
// -----------------------------------------------

// endpoint - travels GET ------------------------
app.get('/travels', async function (req, res) {

    
    let sql = 'SELECT * FROM travels WHERE userid = $1';
    let values = [logindata.userid];
    try {
        let result = await pool.query(sql, values);
        res.status(200).json(result.rows); //send response
    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - travels POST -----------------------
app.post('/travels', async function (req, res) {

    let updata = req.body; //the data sent from the client

    let sql = 'INSERT INTO travels (id, destination, date, km, description, userid) VALUES(DEFAULT, $1, $2, $3, $4, $5) RETURNING *';
    let values = [updata.dest, updata.date, updata.km, updata.descr, updata.userid];

    try {
        let result = await pool.query(sql, values);

        if (result.rows.length > 0) {
            res.status(200).json({ msg: "Insert OK" }); //send response
        }
        else {
            throw "Insert failed";
        }

    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - travels DELETE ------------------------
app.delete('/travels', async function (req, res) {

    let updata = req.body; //the data sent from the client

    let sql = 'DELETE FROM travels WHERE id = $1 RETURNING *';
    let values = [updata.travelID];

    try {
        let result = await pool.query(sql, values);

        if (result.rows.length > 0) {
            res.status(200).json({ msg: "Delete OK" }); //send response
        }
        else {
            throw "Delete failed";
        }
    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - expenses GET ------------------------
app.get('/expenses', async function (req, res) {

    let travelid = req.query.travelid; //the data sent from the client

    let sql = 'SELECT * FROM expenses WHERE travelid = $1';
    let values = [travelid];

    try {
        let result = await pool.query(sql, values);
        res.status(200).json(result.rows); //send response
    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - expenses POST -----------------------
app.post('/expenses', async function (req, res) {

    let updata = req.body; //the data sent from the client     

    let sql = 'INSERT INTO expenses (id, description, amount, travelid) VALUES(DEFAULT, $1, $2, $3) RETURNING *';
    let values = [updata.descr, updata.amount, updata.travelid];

    try {
        let result = await pool.query(sql, values);

        if (result.rows.length > 0) {
            res.status(200).json({ msg: "Insert OK" }); //send response
        }
        else {
            throw "Insert failed";
        }
    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - expenses DELETE ------------------------
app.delete('/expenses', async function (req, res) {

    let updata = req.body; //the data sent from the client

    let sql = 'DELETE FROM expenses WHERE id = $1 RETURNING *';
    let values = [updata.expenseID];

    try {
        let result = await pool.query(sql, values);

        if (result.rows.length > 0) {
            res.status(200).json({ msg: "Delete OK" }); //send response
        }
        else {
            throw "Delete failed";
        }
    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - users POST -----------------------
app.post('/users', async function (req, res) {

    let updata = req.body; //the data sent from the client

    //hashing the password before it is stored in the DB
    let hash = bcrypt.hashSync(updata.passwrd, 10);

    let sql = 'INSERT INTO users (id, email, pswhash) VALUES(DEFAULT, $1, $2) RETURNING *';
    let values = [updata.email, hash];

    try {
        let result = await pool.query(sql, values);

        if (result.rows.length > 0) {
            res.status(200).json({ msg: "Insert OK" }); //send response
        }
        else {
            throw "Insert failed";
        }

    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// endpoint - auth (login) POST ----------------
app.post('/auth', async function (req, res) {

    let updata = req.body; //the data sent from the client    

    //get the user from the database
    let sql = 'SELECT * FROM users WHERE email = $1';
    let values = [updata.email];

    try {
        let result = await pool.query(sql, values);

        if (result.rows.length == 0) {
            res.status(400).json({ msg: "User doesn't exists" });
        }
        else {
            let check = bcrypt.compareSync(updata.passwrd, result.rows[0].pswhash);
            if (check == true) {
                let payload = { userid: result.rows[0].id };
                let tok = jwt.sign(payload, secret, { expiresIn: "12h" }); //create token
                res.status(200).json({ email: result.rows[0].email, userid: result.rows[0].id, token: tok });
            }
            else {
                res.status(400).json({ msg: "Wrong password" });
            }
        }
    }
    catch (err) {
        res.status(500).json({ error: err }); //send error response
    }
});

// start server -----------------------------------
var port = process.env.PORT || 3000;
app.listen(port, function () {
    //console.log('Server listening on port 3000!');
});
