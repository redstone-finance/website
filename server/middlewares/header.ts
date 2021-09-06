import express from "express";

export default function header(req, res: express.Response, next) {
  res.setHeader('X-Community-Contract', 'mzvUgNc8YFk0w5K5H7c8pyT-FC5Y_ba0r7_8766Kx74');
  next();
}