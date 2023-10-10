import { select, input, password, confirm, Separator } from '@inquirer/prompts';
import chalk from 'chalk';
import { BasePrompt } from './BasePrompt.ts';
import { Connection } from '../types/Connection.ts';

export class DatabasePrompt extends BasePrompt {
  async createConnection() {
    const newConnection: Connection = {
      host: '',
      port: 5432,
      username: '',
      password: '',
      database: '',
      name: '',
    };

    if (!this.program.opts().host) {
      newConnection.host = await input({ message: 'Host of the new connection', validate: (value) => !!value });
    } else {
      newConnection.host = this.program.opts().host;
    }

    if (!this.program.opts().port) {
      newConnection.port = Number(
        await input({
          message: 'Port that should be used',
          default: String(newConnection.port),
          validate: (value) => {
            const valueWithFallback = value ? Number(value) : newConnection.host;

            return Number.isNaN(valueWithFallback) ? 'Value must be an integer' : true;
          },
        }),
      );
    } else {
      newConnection.port = Number(this.program.opts().port);
    }

    if (!this.program.opts().username) {
      newConnection.username = await input({ message: 'Username of the new connection', validate: (value) => !!value });
    } else {
      newConnection.username = this.program.opts().username;
    }

    newConnection.password = await password({
      message: 'Password of the new connection',
      validate: (value) => !!value,
    });

    if (!this.program.opts().database) {
      newConnection.database = await input({
        message: 'Name of the database that should be used',
        validate: (value) => !!value,
      });
    } else {
      newConnection.database = this.program.opts().database;
    }

    if (!this.program.opts().name) {
      newConnection.name = await input({
        message: 'Friendly (unique) name for the connection',
        validate: (value) => {
          if (!value) return false;
          if (this.config.connections.some((connection) => connection.name === value))
            return 'That name already exists';

          return true;
        },
      });
    } else {
      newConnection.name = this.program.opts().name;
    }

    this.config.connections.push(newConnection);

    this.writeConfigFile();

    return newConnection;
  }

  async deleteConnection() {
    const connectionToDelete = await this.selectConnection({ message: 'Which connection would you like to delete?' });
    if (!connectionToDelete) return;

    const connectionIndex = this.config.connections.findIndex(({ name }) => name === connectionToDelete.name);

    this.config.connections.splice(connectionIndex, 1);

    this.writeConfigFile();
  }

  async selectConnection(options?: { message: string; showCreateOption?: boolean }) {
    const connectionChoices = this.config.connections?.map((connection) => ({
      name: connection.name,
      value: JSON.stringify(connection),
    }));

    if (!connectionChoices?.length) {
      return console.error(chalk.red('⚠  There are no previously created connections'));
    }

    let connection = await select({
      message: options?.message || 'Which connection would you like to use?',
      choices: [
        ...(options?.showCreateOption ? [{ name: chalk.underline('Create a new connection'), value: undefined }] : []),
        new Separator(chalk.grey('Prevously created connections')),
        ...connectionChoices,
      ],
    });

    if (!connection) {
      const newConnection = await this.createConnection();

      connection = JSON.stringify(newConnection);
    }

    return JSON.parse(connection) as Connection;
  }

  async createSelectQuery(connectionName?: string) {
    let connection: Connection | undefined | void;

    if (connectionName) {
      connection = this.config.connections.find((item) => item.name === connectionName);
    } else if (this.program.opts().connectionName) {
      connection = this.config.connections.find((item) => item.name === this.program.opts().connectionName);
    } else {
      connection = await this.selectConnection({ message: 'Which connection would you like to use?' });
    }

    if (!connection) return console.error(chalk.red('⚠  The selected connection does not exist'));

    const pool = await this.createDatabaseConnectionPool(connection);
    const dbConnection = await this.createDatabaseConnection(pool);

    const tableResponse = await dbConnection.query<{ tableName: string }>(
      `
        SELECT table_name AS "tableName"
        FROM information_schema.tables
        WHERE table_schema = 'public';
      `,
    );

    const selectedTable = await select({
      message: 'Which table would you like to use?',
      choices: tableResponse?.rows.map((row) => ({ name: row.tableName, value: row.tableName })) || [],
    });

    const columnResponse = await dbConnection.query<{ columnName: string }>(
      `
        SELECT column_name AS "columnName"
        FROM information_schema.columns
        WHERE table_name = $1;
      `,
      [selectedTable],
    );

    dbConnection.release();

    const query = [
      'SELECT',
      ...(columnResponse?.rows.map((row, index) => {
        const camelCasedColumn = row.columnName
          .toLowerCase()
          .replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('_', ''));
        const comma = index < columnResponse?.rows.length - 1 ? ',' : '';

        return `  ${selectedTable}.${row.columnName} AS "${camelCasedColumn}"${comma}`;
      }) || []),
      `FROM ${selectedTable};`,
    ].join('\n');

    console.log(`\n${query}\n`);

    const anotherOne = await confirm({ message: 'Would you like to create one for another table?', default: false });
    if (!anotherOne) return;

    this.createSelectQuery(connection.name);
  }
}
