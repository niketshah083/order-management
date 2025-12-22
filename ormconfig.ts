import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mega_shop_db',
  entities: [__dirname + '/dist/**/*.entity.js'],
  migrations: [__dirname + '/dist/database/migrations/*.js'],
  synchronize: false,
  logging: false,
});
