import { Inject } from '@nestjs/common';
import { DataSource, DataSourceOptions } from 'typeorm';
import { DEFAULT_CONNECTION_NAME } from '../typeorm.constants';
import {
  getDataSourceToken,
  getEntityManagerToken,
  getRepositoryToken,
} from './typeorm.utils';
import {Constructor} from "@nestjs/common/utils/merge-with-values.util";

export const InjectRepository = (
  entity: Constructor<any>,
  connection: string = DEFAULT_CONNECTION_NAME,
) => Inject(getRepositoryToken(entity, connection));

export const InjectDataSource: (
  connection?: DataSource | DataSourceOptions | string,
) => ParameterDecorator = (
  connection?: DataSource | DataSourceOptions | string,
) => Inject(getDataSourceToken(connection));

export const InjectEntityManager: (
  connection?: DataSource | DataSourceOptions | string,
) => ParameterDecorator = (
  connection?: DataSource | DataSourceOptions | string,
) => Inject(getEntityManagerToken(connection));
