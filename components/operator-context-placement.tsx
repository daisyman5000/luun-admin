'use client';
import {usePathname} from 'next/navigation';import type {ReactNode} from 'react';
export function OperatorContextPlacement({children,context}:{children:ReactNode;context:ReactNode}){const demand=usePathname()==='/demand';return demand?<>{children}<details className="mx-5 mb-8 rounded-xl border border-line bg-white p-4"><summary className="cursor-pointer text-sm font-medium">Shared plan and general work queue</summary>{context}</details></>:<>{context}{children}</>;}
