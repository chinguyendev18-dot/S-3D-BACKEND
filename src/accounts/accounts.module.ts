import { Module } from '@nestjs/common';

import { RolesModule } from '../roles/roles.module';
import { AccountsController } from './accounts.controller';
import { StaffAccountsService } from './staff-accounts.service';
import { WorkshopStaffController } from './workshop-staff.controller';

@Module({
  imports: [RolesModule],
  controllers: [AccountsController, WorkshopStaffController],
  providers: [StaffAccountsService],
})
export class AccountsModule {}
