#!/usr/bin/env bash
# Source this file from the repository root on the local Linux workstation.
NEKOSTREAM_TOOLS="${NEKOSTREAM_TOOLS:-$HOME/.local/share/nekostream-toolchain}"
if [[ -d "$NEKOSTREAM_TOOLS/jdk17" ]]; then
  export JAVA_HOME="$NEKOSTREAM_TOOLS/jdk17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
if [[ -d "$NEKOSTREAM_TOOLS/android-sdk" ]]; then
  export ANDROID_HOME="$NEKOSTREAM_TOOLS/android-sdk"
  export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  NEKOSTREAM_NODE="$HOME/.local/share/fnm/node-versions/v24.21.0/installation/bin"
  [[ ! -d "$NEKOSTREAM_NODE" ]] || export PATH="$NEKOSTREAM_NODE:$PATH"
fi
