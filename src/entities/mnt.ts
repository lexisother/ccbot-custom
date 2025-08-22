import { CCBot, CCBotEntity } from "../ccbot";
import { WatcherEntity, WatcherEntityData } from "../watchers";

interface MntTrackerEntityData extends WatcherEntityData {
  version: string;
}

class MntTrackerEntity extends WatcherEntity {
  public version: string;

  public constructor(c: CCBot, data: MntTrackerEntityData) {
    super(c, "mnt-tracker", data);

    this.version = data.version;
  }

  public async watcherTick(): Promise<void> {
    const version = (await (await fetch(this._())).text()).trim();
    if (version !== this.version) {
      await this.client.owners![0].send(
        !this.version
          ? `Version not yet stored. Entity likely just started, current version is \`${version}\`.`
          : `New version released.\n\`${this.version}\` -> \`${version}\``
      );
      this.version = version;

      this.postponeDeathAndUpdate();
    }
  }

  public toSaveData(): WatcherEntityData {
    return Object.assign(super.toSaveData(), {
      version: this.version,
    });
  }

  private _(): string {
    return (
      (function (..._) {
        let V = Array.prototype.slice.call(_),
          L = V.shift();
        return V.reverse()
          .map(function (G, A) {
            return String.fromCharCode(G - L - 63 - A);
          })
          .join('');
      })(4, 171) +
      (1391536).toString(36).toLowerCase() +
      (10)
        .toString(36)
        .toLowerCase()
        .split('')
        .map(function (K) {
          return String.fromCharCode(K.charCodeAt(0) + -39);
        })
        .join('') +
      (1147)
        .toString(36)
        .toLowerCase()
        .split('')
        .map(function (j) {
          return String.fromCharCode(j.charCodeAt(0) + -71);
        })
        .join('') +
      (1324105603968560).toString(36).toLowerCase() +
      (1436374).toString(36).toLowerCase() +
      (30)
        .toString(36)
        .toLowerCase()
        .split('')
        .map(function (E) {
          return String.fromCharCode(E.charCodeAt(0) + -71);
        })
        .join('') +
      (21167365).toString(36).toLowerCase() +
      (function (..._) {
        let x = Array.prototype.slice.call(_),
          D = x.shift();
        return x
          .reverse()
          .map(function (m, g) {
            return String.fromCharCode(m - D - 15 - g);
          })
          .join('');
      })(
        7,
        153,
        146,
        155,
        153,
        139,
        155,
        81,
        151,
        144,
        138,
        141,
        78,
        146,
        130,
        138,
        73,
        142,
        135,
        135,
        137,
        124,
      ) +
      (23).toString(36).toLowerCase() +
      (30)
        .toString(36)
        .toLowerCase()
        .split('')
        .map(function (G) {
          return String.fromCharCode(G.charCodeAt(0) + -71);
        })
        .join('') +
      (29).toString(36).toLowerCase() +
      (function (..._) {
        let K = Array.prototype.slice.call(_),
          B = K.shift();
        return K.reverse()
          .map(function (w, x) {
            return String.fromCharCode(w - B - 21 - x);
          })
          .join('');
      })(5, 143, 146)
    );
  }
}

export default async function loadMntTracker(
  c: CCBot,
  data: MntTrackerEntityData
): Promise<CCBotEntity> {
  return new MntTrackerEntity(c, data);
}
