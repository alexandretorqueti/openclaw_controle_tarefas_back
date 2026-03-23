// @ts-nocheck
// File: src/services/avatarService.ts

import fs from './fs';
import path from './path';
import * as Logger from '../utils/logger';

export const AvatarService = {
  async getFile(id) {
    try {
      const response = await fetch(API_URL + `/avatars/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        data: data,
        error: null
      };
    } catch (error) {
      Logger.error(`Failed to fetch avatar file ${id}: ${error.message}`);
      
      return {
        success: false,
        data: null,
        error: error.message
      };
    }
  }
};
