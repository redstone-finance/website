import morgan from 'morgan';
import compression from 'compression';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import throng from 'throng';
import memored from 'memored';
import Arweave from 'arweave';
import mongoose from 'mongoose';
import App from './app';
import HomeController from './controllers/home';
import CacheController from './controllers/caching';
import RedirectController from './controllers/redirection';

const arweave = Arweave.init({
  host: 'arweave.net',
  protocol: 'https',
  port: 443
});

const worker = async (id: string, disconnect: any) => {
  console.log(`Started worker ${id}`);
  await mongoose.connect(process.env.MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true});


  const app = new App({
    port: 5000,
    controllers: [new HomeController(arweave), new CacheController(arweave), new RedirectController()],
    middleWares: [
      morgan('tiny'),
      bodyParser.json(),
      bodyParser.urlencoded({ extended: true }),
      compression(),
      helmet({
        contentSecurityPolicy: false,
      })
    ],
  });

  app.listen();

  process.on('SIGTERM', () => {
    console.log(`Worker ${id} exiting (cleanup here)`);
    disconnect();
  });
};

memored.setup({
  purgeInterval: 1000 * 60 * 60 * 0.5, // 30 mins
});

const WORKERS = +(process.env.WEB_CONCURRENCY || 1);
throng({
  count: WORKERS,
  lifetime: Infinity,
  // @ts-ignore
  worker,
});
