import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserEntity } from 'src/users/entities/user.entity';
import { DistributorEntity } from 'src/users/entities/distributor.entity';

/**
 * Data Access Control Service
 * 
 * Responsible for enforcing role-based data isolation at the query level
 * This ensures users can ONLY access data they're authorized to see
 * 
 * Rules:
 * - SUPER_ADMIN: Can see ALL data (no filtering)
 * - DISTRIBUTOR: Can see ONLY their own distributor's data
 * - MANAGER: Can see ONLY data from their assigned distributors
 */
@Injectable()
export class DataAccessControlService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
  ) {}

  /**
   * Get the list of distributor IDs a user is authorized to access
   * Returns null for SUPER_ADMIN (unrestricted access)
   * Returns array of distributor IDs for DISTRIBUTOR and MANAGER roles
   */
  async getAuthorizedDistributorIds(
    userId: number,
    userRole: string,
  ): Promise<number[] | null> {
    // Super admin can see everything
    if (userRole === 'super_admin') {
      return null; // null means no filtering (see all)
    }

    // Distributor can see only their own data - userId IS the distributorId
    if (userRole === 'distributor') {
      return [userId];
    }

    // Manager can see data from their assigned distributors
    if (userRole === 'manager') {
      // Get manager's assigned distributors via ManyToMany relation
      const managerWithDistributors = await this.userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect(
          'user.managedDistributors',
          'distributor',
        )
        .where('user.id = :userId', { userId })
        .getOne();

      if (!managerWithDistributors || !managerWithDistributors.managedDistributors || managerWithDistributors.managedDistributors.length === 0) {
        throw new Error(
          `Manager user ${userId} has no assigned distributors. Please contact administrator.`,
        );
      }

      return managerWithDistributors.managedDistributors.map((d) => d.id);
    }

    throw new Error(`Unknown user role: ${userRole}`);
  }

  /**
   * Apply data access control filter to a QueryBuilder
   * Automatically adds WHERE clause based on user's role and permissions
   * 
   * Usage:
   * let query = this.repository.createQueryBuilder('alias');
   * query = this.dataAccessControl.applyDistributorFilter(query, 'alias', userId, userRole);
   */
  async applyDistributorFilter<T>(
    query: SelectQueryBuilder<T>,
    tableAlias: string,
    userId: number,
    userRole: string,
  ): Promise<SelectQueryBuilder<T>> {
    const authorizedDistributorIds = await this.getAuthorizedDistributorIds(
      userId,
      userRole,
    );

    // If null, super admin can see everything - no filter needed
    if (authorizedDistributorIds === null) {
      return query;
    }

    // Apply distributor filter
    return query.andWhere(
      `${tableAlias}.distributorId IN (:...distributorIds)`,
      { distributorIds: authorizedDistributorIds },
    );
  }

  /**
   * Apply data access control for JOIN operations
   * When joining through customer or other related entities
   * 
   * Usage:
   * let query = this.repository.createQueryBuilder('order')
   *   .leftJoinAndSelect('order.customer', 'customer');
   * query = this.dataAccessControl.applyDistributorFilterViaRelation(
   *   query, 'customer', userId, userRole
   * );
   */
  async applyDistributorFilterViaRelation<T>(
    query: SelectQueryBuilder<T>,
    relationTableAlias: string,
    userId: number,
    userRole: string,
  ): Promise<SelectQueryBuilder<T>> {
    const authorizedDistributorIds = await this.getAuthorizedDistributorIds(
      userId,
      userRole,
    );

    // If null, super admin can see everything
    if (authorizedDistributorIds === null) {
      return query;
    }

    // Apply filter through the relation
    return query.andWhere(
      `${relationTableAlias}.distributorId IN (:...distributorIds)`,
      { distributorIds: authorizedDistributorIds },
    );
  }

  /**
   * Validate that a user has access to a specific distributor ID
   * Throws error if user is not authorized to access this distributor
   */
  async validateDistributorAccess(
    userId: number,
    userRole: string,
    targetDistributorId: number,
  ): Promise<boolean> {
    // Super admin can access any distributor
    if (userRole === 'super_admin') {
      return true;
    }

    const authorizedIds = await this.getAuthorizedDistributorIds(
      userId,
      userRole,
    );

    if (authorizedIds === null) {
      return true; // Super admin
    }

    if (!authorizedIds.includes(targetDistributorId)) {
      throw new Error(
        `User ${userId} is not authorized to access distributor ${targetDistributorId}`,
      );
    }

    return true;
  }
}
