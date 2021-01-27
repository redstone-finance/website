import express from 'express';
import { Application } from 'express';

export default class App {
  app: Application;
  port: number;

  constructor(settings: { port: number; middleWares: any; controllers: any }) {
    this.app = express();
    this.port = settings.port;

    this.middlewares(settings.middleWares);
    this.routes(settings.controllers);
    this.assets();
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`App listening on http://localhost:${this.port}`);
    });
  }

  private middlewares(mws: any[]) {
    mws.forEach((mw) => {
      this.app.use(mw);
    });
  }

  private routes(ctrls: any[]) {
    ctrls.forEach((ctrl) => {
      this.app.use('/', ctrl.router);
    });
  }

  private assets() {
    this.app.use(express.static('dist'));
  }

  private onError() {
    this.app.on('error', () => {
      console.error('app error', this.app.stack);
      // @ts-ignore
      console.error('on url', this.app.request.url || '');
      // @ts-ignore
      console.error('with headers', this.app.request.header || '');
    });
  }
}
