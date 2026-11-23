import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser, RequirePermissions } from '../access/decorators';
import { requestMeta } from '../common/request-meta';
import { ApiData, ApiPage } from '../openapi/api-data.decorator';
import { DownloadLinkDto } from '../uploads/dto/upload.dto';
import {
  AddExternalModelFileDto,
  CreateExternalModelDto,
  ExternalModelDetailDto,
  ExternalModelQueryDto,
  ExternalModelSummaryDto,
  ExternalModelViewDto,
  LicenseCatalogDto,
  LicenseCheckInputDto,
  LookupQueryDto,
  ModelLookupDto,
  UpdateExternalModelDto,
} from './dto/external-model.dto';
import { ExternalModelsService } from './external-models.service';

const VIEW = 'admin.products.view';
const MANAGE = 'admin.products.manage';

/**
 * Models from MakerWorld, Printables and Thingiverse the shop wants to print for sale: each one is
 * added with a licence check (and its screenshot), and only sellable ones may reach the shop later.
 */
@Controller('external-models')
export class ExternalModelsController {
  constructor(private readonly models: ExternalModelsService) {}

  /** Licences, their verdicts and the boxes a check needs. Before :id. */
  @Get('licenses')
  @RequirePermissions(VIEW)
  @ApiData(LicenseCatalogDto)
  licenses() {
    return this.models.catalog();
  }

  /** Which site and model a pasted link is, and whether it is already in the list. */
  @Get('lookup')
  @RequirePermissions(VIEW)
  @ApiData(ModelLookupDto)
  lookup(@Query() query: LookupQueryDto) {
    return this.models.lookup(query.url);
  }

  /** Counts per state, for the filter tiles. Before :id. */
  @Get('summary')
  @RequirePermissions(VIEW)
  @ApiData(ExternalModelSummaryDto)
  summary(@Query() query: ExternalModelQueryDto) {
    return this.models.summary(query);
  }

  @Get()
  @RequirePermissions(VIEW)
  @ApiPage(ExternalModelViewDto)
  list(@Query() query: ExternalModelQueryDto) {
    return this.models.list(query);
  }

  /** With every check, newest first. */
  @Get(':id')
  @RequirePermissions(VIEW)
  @ApiData(ExternalModelDetailDto)
  get(@Param('id') id: string) {
    return this.models.get(id);
  }

  @Post()
  @RequirePermissions(MANAGE)
  @ApiData(ExternalModelDetailDto, { status: 201 })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateExternalModelDto,
    @Req() request: Request,
  ) {
    return this.models.create(user, dto, requestMeta(request));
  }

  /** Look at the licence again (creators can change it, memberships run out). */
  @Post(':id/checks')
  @RequirePermissions(MANAGE)
  @ApiData(ExternalModelDetailDto, { status: 201 })
  addCheck(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: LicenseCheckInputDto,
    @Req() request: Request,
  ) {
    return this.models.addCheck(user, id, dto, requestMeta(request));
  }

  @Patch(':id')
  @RequirePermissions(MANAGE)
  @ApiData(ExternalModelDetailDto)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExternalModelDto,
    @Req() request: Request,
  ) {
    return this.models.update(user, id, dto, requestMeta(request));
  }

  /** Attach a print file (3MF, STL, STEP, zip…) uploaded with POST /uploads (external-model-file). */
  @Post(':id/files')
  @RequirePermissions(MANAGE)
  @ApiData(ExternalModelDetailDto, { status: 201 })
  addFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddExternalModelFileDto,
    @Req() request: Request,
  ) {
    return this.models.addFile(user, id, dto, requestMeta(request));
  }

  /** A short-lived link that downloads the file under its own name. */
  @Get(':id/files/:fileId/download')
  @RequirePermissions(VIEW)
  @ApiData(DownloadLinkDto)
  fileLink(
    @Param('id') id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.models.fileLink(id, fileId);
  }

  @Delete(':id/files/:fileId')
  @RequirePermissions(MANAGE)
  @ApiData(ExternalModelDetailDto)
  removeFile(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Req() request: Request,
  ) {
    return this.models.removeFile(user, id, fileId, requestMeta(request));
  }
}
