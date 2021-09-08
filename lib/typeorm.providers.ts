import { Provider } from '@nestjs/common';
import {
  DataSource,
  DataSourceOptions
} from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from './common/typeorm.utils';
import {Constructor} from "@nestjs/common/utils/merge-with-values.util";

export function createTypeOrmProviders(
  entities?: Constructor<any>[],
  connection?: DataSource | DataSourceOptions | string,
): Provider[] {
  return (entities || []).map((entity) => ({
    provide: getRepositoryToken(entity, connection),
    useFactory: (source: DataSource) => {
      return source.getRepository(entity);
    },
    inject: [getDataSourceToken(connection)],
  }));
}
