import fs from 'node:fs';
import path from 'node:path';

export function findImWebRoot(startDir = import.meta.dirname) {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'package.json')) &&
      fs.existsSync(path.join(current, 'packages')) &&
      fs.existsSync(path.join(current, 'apps'))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to locate sections/im_web root from ${startDir}`);
    }
    current = parent;
  }
}

export const imWebRoot = findImWebRoot();
export const v1ChecksDir = path.join(imWebRoot, '.ai', 'v1.0', 'checks');
