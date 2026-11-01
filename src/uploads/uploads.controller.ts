import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Response } from 'express';

import type { AuthUser } from '../access/auth-user';
import { CurrentUser, Public } from '../access/decorators';
import { ApiData } from '../openapi/api-data.decorator';
import {
  CreateUploadDto,
  DownloadLinkDto,
  DownloadQueryDto,
  UploadTicketDto,
} from './dto/upload.dto';
import { UploadsService } from './uploads.service';

/**
 * Files go straight from the browser or phone to R2: ask here for a link (POST /uploads), PUT
 * the file to it, then save the returned key with whatever it belongs to.
 */
@Controller()
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('uploads')
  @ApiData(UploadTicketDto, { status: 201 })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUploadDto) {
    return this.uploads.createUpload(user, dto);
  }

  /** A link to open a file (private ones: their owner and staff, for R2_SIGNED_URL_TTL seconds). */
  @Get('uploads/download')
  @ApiData(DownloadLinkDto)
  download(@CurrentUser() user: AuthUser, @Query() query: DownloadQueryDto) {
    return this.uploads.downloadLink(user, query.key);
  }

  /** Public files, while R2 has no public domain (R2_PUBLIC_URL): a redirect to a signed link. */
  @Public()
  @Get('files/*key')
  @ApiExcludeEndpoint()
  async file(@Param('key') key: string | string[], @Res() response: Response) {
    const url = await this.uploads.publicLink(
      Array.isArray(key) ? key.join('/') : key,
    );
    // The signed link lasts R2_SIGNED_URL_TTL; browsers may reuse the redirect a little less.
    response.setHeader('Cache-Control', 'public, max-age=600');
    response.redirect(302, url);
  }
}
