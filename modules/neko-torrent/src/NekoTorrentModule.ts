import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class NekoTorrentModule extends NativeModule<{}> {
  prepareAsync(magnetUri: string): Promise<TorrentMetadata>;
  playAsync(fileIndex: number): Promise<string>;
  statusAsync(): Promise<TorrentStatus>;
  stopAsync(): Promise<void>;
}

export type TorrentVideo = {
  index: number;
  name: string;
  size: number;
};

export type TorrentMetadata = {
  name: string;
  files: TorrentVideo[];
};

export type TorrentStatus = {
  state: 'idle' | 'metadata' | 'ready' | 'downloading' | 'error';
  downloadedBytes?: number;
  totalBytes?: number;
  downloadRate?: number;
  peers?: number;
  error?: string;
};

export default requireOptionalNativeModule<NekoTorrentModule>('NekoTorrent');
