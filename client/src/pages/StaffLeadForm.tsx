import { InternalIntakeLanguage } from '../i18n/public-language';
import React from 'react';
import { PublicLeadForm } from './PublicLeadForm';
export const StaffLeadForm: React.FC<{user:any}>=({user})=><InternalIntakeLanguage><div className="public-site"><PublicLeadForm staffUser={user}/></div></InternalIntakeLanguage>;
