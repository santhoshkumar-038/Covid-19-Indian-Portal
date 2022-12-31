const express = require("express");
const app = express();
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
let db = null;

const initiateDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB error ${e.message}`);
  }
};
const authToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = null;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    if (jwtToken == undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY SECRET KEY", (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;

          next();
        }
      });
    }
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};
initiateDBAndServer();
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `select * from user where username = '${username}'`;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const passwordStatus = bcrypt.compare(password, dbUser.password);

    if (passwordStatus === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const jwtToken = await jwt.sign(
        { username: dbUser.username },
        "MY SECRET KEY"
      );
      console.log(jwtToken);
      response.send({ jwtToken: jwtToken });
    }
  }
});

app.get("/states/", authToken, async (request, response) => {
  const { username } = request;
  const getStatesQuery = `select * from state order by state_id asc`;
  const statesArray = await db.all(getStatesQuery);
  const statesObject = statesArray.map((obj) => {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  });
  response.send(statesObject);
});

app.get("/states/:stateId/", authToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `select * from state where state_id = '${stateId}'`;
  const stateArray = await db.get(getStateQuery);
  const stateObject = {
    stateId: stateArray.state_id,
    stateName: stateArray.state_name,
    population: stateArray.population,
  };
  response.send(stateObject);
});

app.post("/districts/", authToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtPostQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) values('${districtName}','${stateId}','${cases}','${cured}','${active}','${deaths}')`;
  await db.run(districtPostQuery);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const getDistrictQuery = `select * from district where district_id = '${districtId}'`;
  const districtArray = await db.get(getDistrictQuery);
  const districtObject = {
    districtId: districtArray.district_id,
    districtName: districtArray.district_name,
    stateId: districtArray.state_id,
    cases: districtArray.cases,
    cured: districtArray.cured,
    active: districtArray.active,
    deaths: districtArray.deaths,
  };
  response.send(districtObject);
});

app.delete("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const deleteDistrictQuery = `delete from district where district_id = '${districtId}'`;
  await db.run(deleteDistrictQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId/", authToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrictQuery = `update district set district_name = '${districtName}',state_id ='${stateId}',cases='${cases}',cured='${cured}',active='${active}',deaths='${deaths}' where district_id = '${districtId}'`;
  await db.run(updateDistrictQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateStatsQuery = `select sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths from district where state_id = '${stateId}'`;
  const statesStatusArray = await db.get(getStateStatsQuery);

  response.send(statesStatusArray);
});

module.exports = app;
