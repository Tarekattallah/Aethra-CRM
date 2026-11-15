import React from 'react';
import {useClientBrand} from '../branding/client-brand';

export function ClientBrand({compact=false}:{compact?:boolean}) {
  const {brand}=useClientBrand();
  return <img src={brand.logoUrl} alt={brand.companyName} width={596} height={476}
    className={compact?'w-28 h-20 object-contain shrink-0':'w-28 h-24 sm:w-36 sm:h-28 object-contain'} />;
}
