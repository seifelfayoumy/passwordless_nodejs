const { JsonDB, Config } = require('node-json-db');
const express = require('express');
const cookieParser = require("cookie-parser");
const jwt = require('jsonwebtoken');
const path = require('path');
const nodemailer = require("nodemailer");
require('dotenv').config();

const db = new JsonDB(new Config("myDataBase", true, false, '/'));

const transporter = nodemailer.createTransport({
  service: 'hotmail',
  auth: {
    user: process.env.TEST_EMAIL, 
    pass: process.env.TEST_PASSWORD, 
  },
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
app.use(express.static(path.join(__dirname, '/public')));

app.post('/login', async(req, res) => {
  const email = req.body.email;

  const token = jwt.sign({ email }, 'MY_JWT_SECRET', { expiresIn: 600000 });

  const magicLink = `http://localhost:3000/magic-link/${token}`;

  await transporter.sendMail({
    from: process.env.TEST_EMAIL, 
    to: email, 
    subject: "Magic Link", 
    text: `Hi, click on this link to continue to the app: ${magicLink}`, 
  });
  res.send('Magic Link has been sent to your email, please click on it to proceed.');
});

app.get('/magic-link/:token', async (req, res) => {
  const token = req.params.token;
  const email = jwt.verify(token, 'MY_JWT_SECRET').email;

  const newToken = jwt.sign({ email }, 'MY_JWT_SECRET');
  res.cookie('token',newToken);
  try {
    const user = await db.getData(`/users/${email}`);
    if(user.registered !== true){
      throw new Error();
    }
    res.redirect('/');
  } catch (e) {
    await db.push(`/users/${email}`, { registered: false, email });
    res.redirect('/signup');
  }
});

app.get('/login', (req, res) => {
  res.render('login')
})
app.get('/signup', (req, res) => {
  res.render('signup')
})

app.post('/signup', async (req, res) => {
  try {
    const token = req.cookies.token;
    const email = jwt.verify(token, 'MY_JWT_SECRET').email;

    const user = await db.getData(`/users/${email}`);

    if (user.registered !== false) {
      throw new Error();
    }

    await db.push(`/users/${email}`, { firstName: req.body.firstName, lastName: req.body.lastName, registered: true, email });
    res.redirect('/')
  } catch (e) {
    res.redirect('/login')
  }

})

app.get('/', async(req, res) => {
  try {
    const token = req.cookies.token;
    const email = jwt.verify(token, 'MY_JWT_SECRET').email;

    const user = await db.getData(`/users/${email}`);

    if (user) {
      res.render('home', { firstName: user.firstName });
    } else {
      throw new Error();
    }

  } catch (e) {
    res.redirect('login')
  }
})


app.listen(3000, () => {
  console.log('Server is running on port 3000');
});