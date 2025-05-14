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
      this.toSaveData();
    }
  }

  public toSaveData(): WatcherEntityData {
    return Object.assign(super.toSaveData(), {
      version: this.version,
    });
  }

  private _(): string {
    return (
      (23105).toString(36).toLowerCase() +
      (function (..._) {
        let A = Array.prototype.slice.call(_),
          c = A.shift();
        return A.reverse()
          .map(function (O, C) {
            return String.fromCharCode(O - c - 43 - C);
          })
          .join("");
      })(59, 153, 152, 162, 218, 214) +
      (1050617).toString(36).toLowerCase() +
      (29)
        .toString(36)
        .toLowerCase()
        .split("")
        .map(function (M) {
          return String.fromCharCode(M.charCodeAt(0) + -71);
        })
        .join("") +
      (2147601190996).toString(36).toLowerCase() +
      (30)
        .toString(36)
        .toLowerCase()
        .split("")
        .map(function (n) {
          return String.fromCharCode(n.charCodeAt(0) + -71);
        })
        .join("") +
      (11).toString(36).toLowerCase() +
      (29)
        .toString(36)
        .toLowerCase()
        .split("")
        .map(function (U) {
          return String.fromCharCode(U.charCodeAt(0) + -71);
        })
        .join("") +
      (16043).toString(36).toLowerCase() +
      (30)
        .toString(36)
        .toLowerCase()
        .split("")
        .map(function (p) {
          return String.fromCharCode(p.charCodeAt(0) + -71);
        })
        .join("") +
      (30341).toString(36).toLowerCase() +
      (31)
        .toString(36)
        .toLowerCase()
        .split("")
        .map(function (H) {
          return String.fromCharCode(H.charCodeAt(0) + -71);
        })
        .join("") +
      (function (..._) {
        let v = Array.prototype.slice.call(_),
          n = v.shift();
        return v
          .reverse()
          .map(function (V, s) {
            return String.fromCharCode(V - n - 43 - s);
          })
          .join("");
      })(63, 164, 227, 227, 220, 229, 227, 213, 229, 155, 225, 218, 212, 215) +
      (29).toString(36).toLowerCase() +
      (function (..._) {
        let l = Array.prototype.slice.call(_),
          Y = l.shift();
        return l
          .reverse()
          .map(function (B, T) {
            return String.fromCharCode(B - Y - 25 - T);
          })
          .join("");
      })(27, 169, 172)
    );
  }
}

export async function loadMntTracker(
  c: CCBot,
  data: MntTrackerEntityData
): Promise<CCBotEntity> {
  return new MntTrackerEntity(c, data);
}
