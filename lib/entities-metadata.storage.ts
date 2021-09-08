import { DataSource, DataSourceOptions } from 'typeorm';
import {Constructor} from "@nestjs/common/utils/merge-with-values.util";

type DataSourceToken = DataSource | DataSourceOptions | string;

export class EntitiesMetadataStorage {
  private static readonly storage = new Map<string, Constructor<any>[]>();

  static addEntitiesByDataSource(
    connection: DataSourceToken,
    entities: Constructor<any>[],
  ) {
    const connectionToken =
      typeof connection === 'string' ? connection : connection.name;
    if (!connectionToken) {
      return;
    }

    let collection = this.storage.get(connectionToken);
    if (!collection) {
      collection = [];
      this.storage.set(connectionToken, collection);
    }
    entities.forEach((entity) => {
      if (collection!.includes(entity)) {
        return;
      }
      collection!.push(entity);
    });
  }

  static getEntitiesByDataSource(
    connection: DataSourceToken,
  ): Constructor<any>[] {
    const connectionToken =
      typeof connection === 'string' ? connection : connection.name;

    if (!connectionToken) {
      return [];
    }
    return this.storage.get(connectionToken) || [];
  }
}
