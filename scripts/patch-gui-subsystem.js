const fs = require('fs');
const path = require('path');

const IMAGE_SUBSYSTEM_WINDOWS_GUI = 2;
const OPTIONAL_HEADER_SUBSYSTEM_OFFSET = 0x44;

function patchExeToGuiSubsystem(exePath) {
  const buffer = fs.readFileSync(exePath);

  if (buffer.length < 0x40) {
    throw new Error('Invalid PE file: too small');
  }

  const peHeaderOffset = buffer.readUInt32LE(0x3c);
  const signature = buffer.toString('ascii', peHeaderOffset, peHeaderOffset + 4);
  if (signature !== 'PE\u0000\u0000') {
    throw new Error('Invalid PE file: missing PE signature');
  }

  const optionalHeaderOffset = peHeaderOffset + 24;
  const magic = buffer.readUInt16LE(optionalHeaderOffset);
  if (magic !== 0x10b && magic !== 0x20b) {
    throw new Error(`Unknown optional header magic: 0x${magic.toString(16)}`);
  }

  const subsystemOffset = optionalHeaderOffset + OPTIONAL_HEADER_SUBSYSTEM_OFFSET;
  const oldSubsystem = buffer.readUInt16LE(subsystemOffset);
  if (oldSubsystem === IMAGE_SUBSYSTEM_WINDOWS_GUI) {
    return {
      changed: false,
      oldSubsystem,
    };
  }

  buffer.writeUInt16LE(IMAGE_SUBSYSTEM_WINDOWS_GUI, subsystemOffset);
  fs.writeFileSync(exePath, buffer);

  return {
    changed: true,
    oldSubsystem,
  };
}

function main() {
  const inputPath = process.argv[2] || 'windowshow.exe';
  const exePath = path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(exePath)) {
    throw new Error(`EXE not found: ${exePath}`);
  }

  const result = patchExeToGuiSubsystem(exePath);
  if (result.changed) {
    console.log(`Patched to GUI subsystem: ${exePath} (from ${result.oldSubsystem} -> 2)`);
  } else {
    console.log(`Already GUI subsystem: ${exePath}`);
  }
}

main();
