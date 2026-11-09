// Reads the backup password from the terminal with echo off. It is the only
// source of the password: never an argument, an environment variable or a file.
export function promptHiddenPassword(question = 'Backup password (typed input is hidden): ') {
  if (!process.stdin.isTTY) {
    return Promise.reject(new Error('The password prompt needs an interactive terminal.'));
  }
  return new Promise((resolvePassword, rejectPassword) => {
    const input = process.stdin;
    const output = process.stderr;
    let value = '';
    const finish = (error, result) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      if (error) rejectPassword(error); else resolvePassword(result);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\r' || character === '\n' || character === '\u0004') return finish(null, value);
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    output.write(question);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}
