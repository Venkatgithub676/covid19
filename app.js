const express = require("express");
const app = express();
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const { open } = sqlite;
const bcrypt = require("bcrypt");
let jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log(`Server is running at http://localhost:3000/`);
    });
  } catch (err) {
    console.log(`DB error: ${err.message}`);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers.authorization;

  if (authHeader !== undefined) {
    const authToken = authHeader.split(" ")[1];
    if (authToken !== undefined) {
      let verification = jwt.verify(
        authToken,
        "MY_SECRET_TOKEN",
        async (error, payload) => {
          if (error) {
            response.status(400);
            response.send("Invalid JWT Token");
          } else {
            next();
          }
        }
      );
    } else {
      response.status(400);
      response.send("Invalid JWT Token");
    }
  } else {
    response.status(400);
    response.send("No Token");
  }
};

// login api

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  const getUser = `select * from user where username='${username}';`;
  const dbUser = await db.get(getUser);
  if (dbUser !== undefined) {
    const comparePass = await bcrypt.compare(password, dbUser.password);
    if (comparePass) {
      const payload = { username };
      let jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

// get states api

app.get("/states/", authenticateToken, async (request, response) => {
  const selectQuery = `select * from state;`;
  const getStates = await db.all(selectQuery);
  const res = getStates.map((each) => ({
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  }));
  response.send(res);
});

// get a state api

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const selectQuery = `select * from state where state_id=${stateId};`;
  const getState = await db.get(selectQuery);
  const res = {
    stateId: getState.state_id,
    stateName: getState.state_name,
    population: getState.population,
  };
  response.send(res);
});

// create district  api

app.post("/districts", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const insertQuery = `insert into district(district_name,state_id,cases,cured,active,deaths) values('${districtName}',${stateId},${cases},${cured},${active},${deaths})`;
  const res = await db.run(insertQuery);
  response.send("District Successfully Added");
});

// get a district api

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId = "" } = request.params;
    const selectQuery = `select * from district where district_id=${districtId};`;
    const res = await db.get(selectQuery);
    const res1 = {
      districtId: res.district_id,
      stateName: res.district_name,
      stateId: res.state_id,
      cases: res.cases,
      cured: res.cured,
      active: res.active,
      deaths: res.deaths,
    };
    response.send(res1);
    // console.log(res);
  }
);

// delete a district api

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectQuery = `delete from district where district_id=${districtId};`;

    await db.run(selectQuery);
    response.send("District Removed");
    // console.log(res);
  }
);

// update district api

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cured,
      active,
      deaths,
      cases,
    } = request.body;
    const updateQuery = `update district set district_name='${districtName}',
    state_id=${stateId},
    cured=${cured},
    active=${active},
    deaths=${deaths},
    cases=${cases} where district_id=${districtId};`;
    const res = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// get stats api
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `select sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths from state inner join district
    on district.state_id=state.state_id;`;
    const res = await db.all(query);
    response.send(res);
  }
);
module.exports = app;
