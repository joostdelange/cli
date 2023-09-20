import { Console } from 'node:console';
import { Transform } from 'node:stream';

export function tableWithoutStringQuotes(input: never[]) {
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
