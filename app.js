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
module.exports = app;

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
        request.username = payload.username;
        next();
      }
    });
  }
};

/*const convertTweetToResponse =(object) => {
    return{
        username: object.username,
        tweet: object.tweet,
    }
}*/

const isValidUser = async (username) => {
  const userIdQuery = `select user_id fromuser where username ='${username}';`;
  const user = await db.get(userIdQuery);
  const { user_id } = user;
  return user_id;
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

const getUserId = async (username) => {
  const userIdQuery = `select user_id from user where username = '${username}';`;
  const userId = await db.get(userIdQuery);
  return userId.user_id;
};

//API 3

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  let { username } = request;
  const userId = await getUserId(username);
  const getTweetsQuery = `
  select 
  username,
  tweet,
  tweet.date_time as dateTime
   from 
   (follower inner join tweet on follower.following_user_id=tweet.user_id) 
   as T natural join user where follower.follower_user_id =${userId} 
   order by tweet.date_time desc 
   limit 4;`;
  const tweetList = await db.all(getTweetsQuery);
  response.send(tweetList);
});

//API 4

app.get("/user/following/", authentication, async (request, response) => {
  const { username } = request;
  const userId = await getUserId(username);
  const getFollowersQuery = `select name from user inner join follower on user.user_id = follower.following_user_id where follower.follower_user_id = ${userId};`;
  const followersList = await db.all(getFollowersQuery);
  response.send(followersList);
});

//API 5

app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;
  const userId = await getUserId(username);
  const getUserFollowersQuery = `SELECT name FROM user INNER JOIN follower ON user.user_id = follower.follower_user_id WHERE follower.following_user_id = ${userId};`;
  const userFollowersList = await db.all(getUserFollowersQuery);
  response.send(userFollowersList);
});

//API 6

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const userId = await getUserId(username);
  const { tweetId } = request.params;
  const isTweetQuery = `
  SELECT
    *
  FROM
    tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id
  WHERE
    tweet_id = ${tweetId}
    AND follower_user_id = ${userId};
  `;
  const tweet = await db.get(isTweetQuery);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getTweetQuery = `select tweet.tweet,count(like_id) as likes,count(reply_id) as replies,tweet.date_time as dateTime
     from tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id
INNER JOIN like ON tweet.user_id = like.user_id
INNER JOIN reply ON tweet.user_id = tweet.user_id 

WHERE tweet.tweet_id = ${tweetId};`;
    const tweetDetails = await db.get(getTweetQuery);
    response.send(tweetDetails);
  }
});

//API 7

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const isTweet = `SELECT
    *
  FROM
    tweet INNER JOIN follower ON tweet.user_id = follower.following_user_id
  WHERE
    tweet_id = ${tweetId};`;

    const tweet = await db.get(isTweet);
    if (tweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const getLikesCountQuery = `select  username from (tweet inner join like on tweet.tweet_id = like.tweet_id) inner join user on user.user_id = like.user_id
        where tweet.tweet_id = ${tweetId};`;

      const getLikes = await db.all(getLikesCountQuery);
      const dataList = getLikes.map((each) => each.username);
      response.send({ likes: dataList });
    }
  }
);

//API 8

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;

    const isTweetQuery = `select * from tweet inner join follower on tweet.user_id = follower.following_user_id where tweet.tweet_id = ${tweetId};`;
    const isTweet = await db.get(isTweetQuery);

    if (isTweet === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const tweetReplyQuery = `select user.name,reply.reply from
      tweet inner join reply on tweet.tweet_id = reply.tweet_id inner join
      user on reply.user_id =  user.user_id  where tweet.tweet_id = ${tweetId};`;

      const replyCount = await db.all(tweetReplyQuery);
      response.send({ replies: replyCount });
    }
  }
);

app.get("/user/tweets/", authentication, async (request, response) => {
  const { username } = request;
  const userId = await getUserId(username);
  const tweetQuery = `
    SELECT
    tweet,COUNT(*) AS likes,
    (
        SELECT
          COUNT(*) AS replies
        FROM
          tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
       WHERE tweet.user_id =${userId} 
        GROUP BY
          tweet.tweet_id
    ) AS replies,tweet.date_time as dateTime
  FROM
    tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
    WHERE tweet.user_id =${userId}
 
  GROUP BY
    tweet.tweet_id;
  `;
  const tweetData = await db.all(tweetQuery);

  response.send(tweetData);
});

//API 10

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const createTweetQuery = `Insert into tweet (tweet)
    values('${tweet}');`;
  await db.run(createTweetQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const userId = await getUserId(username);
  const { tweetId } = request.params;

  const isTweetQuery = `select * from tweet where tweet_id = ${tweetId};`;

  const isTweet = await db.get(isTweetQuery);
  const { user_id } = isTweet;
  if (userId === user_id) {
    const deleteTweetQuery = `delete from tweet where tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
