export interface Connection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  name: string;
}

export interface Config {
  connections: Connection[];
}
