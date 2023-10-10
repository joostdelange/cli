import os from 'node:os';
import fs from 'node:fs';
import { Console } from 'node:console';
import { Transform } from 'node:stream';
import ora, { Ora } from 'ora';
import { Command } from 'commander';
import { Config } from '../types/Config.ts';

export class BasePrompt {
  program: Command;
  spinner: Ora;
  configDirPath = `${os.homedir()}/.config/joost-cli`;
  configFilePath = `${this.configDirPath}/config.json`;
  config: Config = {
    connections: [],
  };

  constructor(program: Command) {
    this.program = program;
    this.spinner = ora();

    if (!fs.existsSync(this.configDirPath)) {
      fs.mkdirSync(this.configDirPath, { recursive: true });
    }

    if (!fs.existsSync(this.configFilePath)) {
      fs.writeFileSync(this.configFilePath, JSON.stringify(this.config));
    }

    this.config = JSON.parse(this.getConfigFile().toString()) as Config;
  }

  writeConfigFile(config?: Config) {
    fs.writeFileSync(this.configFilePath, JSON.stringify(config || this.config));
  }

  getConfigFile() {
    return fs.readFileSync(this.configFilePath);
  }

  tableWithoutStringQuotes(input: never[]) {
    const transform = new Transform({
      transform(chunk, _enc, cb) {
        cb(null, chunk);
      },
    });
    const logger = new Console({ stdout: transform });

    logger.table(input);

    const table = (transform.read() || '').toString();
    let result = '';

    for (const row of table.split(/[\r\n]+/)) {
      const replaced = row
        .replace(/[^┬]*┬/, '┌')
        .replace(/^├─*┼/, '├')
        .replace(/│[^│]*/, '')
        .replace(/^└─*┴/, '└')
        .replace(/'/g, ' ');

      result = `${result}${replaced}\n`;
    }

    return result;
  }
}
