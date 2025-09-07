import express from "express";
import cors from "cors";
import helmet from "helmet";
import { networkConnections, networkStats } from "systeminformation";
const app = express();
app.use(cors(), helmet());
app.post("/attendance", (req, res) => {
    const roll = req.body.rollno
})
app.listen(80, "0.0.0.0", () => {
	console.log("Attendance Dashbaord running on http://127.0.0.1");
});
