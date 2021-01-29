import express from 'express';
import { pages } from '../pages';

export default class RedirectController {
  path = '/';
  router = express.Router();

  constructor() {
    this.initRoutes();
  }

  private initRoutes() {
    this.router.get(`${this.path}index.html`, (_, res) => {
      res.redirect('/');
    });

    for(const page of pages) {
      this.router.get(`${this.path}${page}.html`, (_, res) => {
        res.redirect(`./${page}`);
      });
    }
  }

  private index(req: express.Request, res: express.Response) {
    res.send('hello-world');
  }
}