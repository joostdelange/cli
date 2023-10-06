import os from 'node:os';
import fs from 'node:fs';
import ora, { Ora } from 'ora';
import { select, input, password, Separator } from '@inquirer/prompts';
import colors from '@colors/colors';
import { Config, Connection } from '../types/database/Config.js';

export class DatabasePrompt {
  spinner: Ora;
  configDirPath: string = `${os.homedir()}/.config/joost-cli`;
  configFilePath: string = `${this.configDirPath}/db-connections.json`;
  config: Config = { connections: [] };

  constructor() {
    this.spinner = ora();
    this.writeConfigFile();
    this.config = JSON.parse(this.getConfigFile().toString()) as Config;
  }

  writeConfigFile(config?: Config) {
    if (!fs.existsSync(this.configDirPath)) {
      fs.mkdirSync(this.configDirPath, { recursive: true });
    }

    if (!fs.existsSync(this.configFilePath)) {
      fs.writeFileSync(this.configFilePath, JSON.stringify(config || this.config));
    }
  }

  getConfigFile() {
    return fs.readFileSync(this.configFilePath);
  }

  async createConnection() {
    const newConnection: Connection = {
      host: '',
      port: 5432,
      username: '',
      password: '',
      database: '',
      name: '',
    };

    newConnection.host = await input({ message: 'What is the host?', validate: (value) => !!value });
    newConnection.port = Number(
      await input({
        message: 'What is the port?',
        default: String(newConnection.port),
        validate: (value) => {
          const valueWithFallback = value ? Number(value) : newConnection.host;

          return Number.isNaN(valueWithFallback) ? 'Value must be an integer' : true;
        },
      }),
    );
    newConnection.username = await input({ message: 'What is the username?', validate: (value) => !!value });
    newConnection.password = await password({ message: 'What is the password?', validate: (value) => !!value });
    newConnection.database = await input({ message: 'What is the database name?', validate: (value) => !!value });
    newConnection.name = await input({
      message: 'Give this connection a name',
      validate: (value) => {
        if (!value) return false;
        if (this.config.connections.some((connection) => connection.name === value)) return 'That name already exists';

        return true;
      },
    });

    this.config.connections.push(newConnection);

    this.writeConfigFile();

    return newConnection;
  }

  async selectConnection() {
    let connection = await select({
      message: 'Which connection would you like to use?',
      choices: [
        { name: colors.underline('Create a new connection'), value: undefined },
        new Separator(colors.grey('Prevously created connections')),
        ...(this.config.connections?.map((connection) => ({
          name: connection.name,
          value: JSON.stringify(connection),
        })) || []),
      ],
    });

    if (!connection) {
      const newConnection = await this.createConnection();

      connection = JSON.stringify(newConnection);
    }

    return JSON.parse(connection) as Connection;
  }
}
