const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3008, () => {
      console.log("Server Running at http://localhost:3008");
    });
  } catch (e) {
    console.log(`DB error ${e.message}`);
  }
};

initializeDbServer();

const authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfghjkl", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `select *  from user where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUser = `insert into user (name,username,password,gender) 
            values('${name}','${username}','${hashedPassword}','${gender}');`;
      await db.run(createUser);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API 2

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `select * from user where username = '${request.body.username}';`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "asdfghjkl");
      //response.send("Successful login of the user");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3

app.get("/user/tweets/feed/", async (request, response) => {
  const getTweetsQuery = `select user.username,tweet.tweet,tweet.date_time from user inner join follower on user.user_id = follower.follower_id inner join tweet on user.user_id = tweet.user_id order by tweet.date_time desc limit 4;`;
  const tweetList = await db.all(getTweetsQuery);
  response.send(tweetList);
});

//API 4

app.get("/user/following/", async (request, response) => {
  const getFollowersQuery = `select distinct user.name from user inner join follower on user.user_id= follower.follower_user_id ;`;
  const followersList = await db.all(getFollowersQuery);
  response.send(followersList);
});

//API 5

app.get("user/followers/", async (request, response) => {
  const getUserFollowersQuery = `select user.name from user inner join follower on user.user_id = follower.follower_user_id;`;
  const userFollowersList = await db.all(getUserFollowersQuery);
  response.send(userFollowersList);
});

//API 6

/*app.get("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const getTweetQuery = ` SELECT
    *
  FROM
    tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id
  WHERE
    tweet_id = ${tweetId};`;
  const tweet = db.get(getTweetQuery);
  if (tweet === undefined) {
    response.status();
    response.send("");
  } else {
    const getLikesCountQuery = `SELECT
    count(*) as likesCount
  FROM
    tweet INNER JOIN like ON tweet.user_id = like.user_id
  WHERE
    like.tweet_id = ${tweetId};`;
    const likesCount = await db.all(getLikesCountQuery);

    const getReplyCountQuery = `SELECT
    count(*) as replyCount
  FROM
    tweet INNER JOIN reply ON tweet.user_id = tweet.user_id
  WHERE
    tweet.tweet_id = ${tweetId};`;
    const replyCount = await db.all(getReplyCountQuery);

    response.send({
      tweet: tweet["tweet"],
      likes: likesCount[0]["likesCount"],
      replies: replyCount[0]["replyCount"],
      dateTime: tweet["date_time"],
    });
    response.send(tweet);
  }
});*/

app.get("/tweets/:tweetId/", async (request, response) => {
  const { tweetId } = request.params;
  const username = "Narendra Modi";
  const getTweetsQuery = `SELECT
    count(*) as replyCount
  FROM
    tweet INNER JOIN reply ON tweet.user_id = tweet.user_id
  WHERE
    tweet.tweet_id = ${tweetId}
     ;`;

  const tweets = await db.get(getTweetsQuery);
  response.send({ replyCount: tweets["replyCount"] });
});
